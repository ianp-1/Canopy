import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchCurrentWeather, isDroughtCondition } from '@/lib/oracle/weather-oracle';
import { finishEscrow } from '@/lib/xrpl/escrow-finish';
import { Wallet } from 'xrpl';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. Authorization Check (for Vercel Cron)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        // Allow bypass in dev, strictly enforce in prod
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log("[Cron] Starting Policy Processing...");

        // 2. Fetch Active Policies
        const activePolicies = await prisma.policy.findMany({
            where: {
                status: 'ACTIVE',
                xrplEscrowId: { not: null }, // Must have an escrow
                escrowCondition: { not: null }
            }
        });

        console.log(`[Cron] Found ${activePolicies.length} active policies.`);
        const results = [];

        // 3. Process Each Policy
        for (const policy of activePolicies) {
            try {
                // Parse Coordinates
                const coords = policy.coordinates as { lat: number, lng: number } | null;
                if (!coords) {
                    console.warn(`[Cron] Policy ${policy.id} missing coordinates.`);
                    continue;
                }

                // 4. Fetch Weather
                const weather = await fetchCurrentWeather(coords.lat, coords.lng);
                const threshold = policy.thresholdRainfall || 10; // Default 10mm
                const triggered = isDroughtCondition(weather, threshold);

                // 5. Log Weather Data
                await prisma.weatherLog.create({
                    data: {
                        policyId: policy.id,
                        data: weather as any, // Store full JSON
                        isTriggerMet: triggered
                    }
                });

                if (triggered) {
                    console.log(`[Cron] TRIGGER: Policy ${policy.id} met drought conditions.`);

                    // 6. Execute Payout (XRPL)
                    if (!process.env.XRPL_INSURER_SEED) {
                        throw new Error("XRPL_INSURER_SEED missing");
                    }

                    // In this design, the Insurer/Oracle wallet executes the finish
                    // Note: Ideally this is a separate Oracle wallet
                    const oracleWallet = Wallet.fromSeed(process.env.XRPL_INSURER_SEED);

                    // We need the Owner Address (Insurer)
                    // Derived from the same seed for this simplified demo
                    const ownerAddress = oracleWallet.address;

                    if (!policy.escrowSequence || !policy.escrowCondition || !policy.escrowFulfillment) {
                        throw new Error("Missing escrow metadata");
                    }

                    const txResult = await finishEscrow(
                        oracleWallet,
                        ownerAddress,
                        policy.escrowSequence,
                        policy.escrowCondition,
                        policy.escrowFulfillment
                    );

                    if (txResult.success) {
                        // 7. Update Policy Status
                        await prisma.policy.update({
                            where: { id: policy.id },
                            data: {
                                status: 'CLAIMED',
                                claimTxHash: txResult.txHash,
                                claimedAt: new Date()
                            }
                        });
                        results.push({ policyId: policy.id, status: 'CLAIMED', tx: txResult.txHash });
                    } else {
                        console.error(`[Cron] XRPL Finish Failed for ${policy.id}`);
                        results.push({ policyId: policy.id, status: 'FAILED_TX' });
                    }
                } else {
                    results.push({ policyId: policy.id, status: 'HEALTHY' });
                }

            } catch (pError) {
                console.error(`[Cron] Error processing policy ${policy.id}:`, pError);
                results.push({ policyId: policy.id, error: String(pError) });
            }
        }

        return NextResponse.json({ success: true, processed: results });
    } catch (error) {
        console.error("[Cron] Global Error:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
