import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchCurrentWeather, isDroughtCondition } from '@/lib/oracle/weather-oracle';
import { sendRlusdPayout } from '@/lib/xrpl/escrow-finish';
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
                await prisma.oracleLog.create({
                    data: {
                        policyId: policy.id,
                        action: triggered ? 'CHECK_TRIGGERED' : 'CHECK_TRIGGERED',
                        weatherData: weather as any, // Store full JSON
                        consensusScore: 1.0 // Single oracle source
                    }
                });

                if (triggered) {
                    console.log(`[Cron] TRIGGER: Policy ${policy.id} met drought conditions.`);

                    // 6. Execute Payout (XRPL RLUSD Payment)
                    if (!process.env.XRPL_INSURER_SEED) {
                        throw new Error("XRPL_INSURER_SEED missing");
                    }

                    const insurerWallet = Wallet.fromSeed(process.env.XRPL_INSURER_SEED);
                    const farmerAddress = (policy as any).user?.walletAddress;

                    if (!farmerAddress) {
                        throw new Error("Farmer wallet address not found");
                    }

                    if (!policy.escrowCondition || !policy.escrowFulfillment) {
                        throw new Error("Missing commitment metadata");
                    }

                    const txResult = await sendRlusdPayout(
                        insurerWallet,
                        farmerAddress,
                        Number(policy.coverageAmount),
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
