'use server'

import { CreatePolicySchema, CreatePolicyInput } from '@/lib/types/policy-types';
import prisma from '@/lib/prisma';
import { createConditionalEscrow } from '@/lib/xrpl/escrow-create';
import { preparePolicyNFTMint } from '@/lib/xrpl/nft-mint';
import { Wallet } from 'xrpl';
import { revalidatePath } from 'next/cache';

// Mock function to get the Insurer Wallet (In production, use secure key management)
const getInsurerWallet = () => {
    if (!process.env.XRPL_INSURER_SEED) {
        return { error: "Server Misconfiguration: XRPL_INSURER_SEED missing" };
    }
    try {
        return { wallet: Wallet.fromSeed(process.env.XRPL_INSURER_SEED) };
    } catch (e) {
        return { error: "Invalid XRPL_INSURER_SEED" };
    }
};

export async function createPolicy(data: CreatePolicyInput) {
    // 1. Validate Input
    const result = CreatePolicySchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.flatten() };
    }

    const { cropId, locationName, coordinates, coverageAmount, riskThreshold } = result.data;

    if (!data.userId) {
        return { success: false, error: "User ID is required" };
    }
    const userId = data.userId;

    try {
        console.log(`[CreatePolicy] Starting for ${locationName}`);

        // Fetch User to get Wallet Address
        // In a real app, userId comes from session. Here we might need to find a user or create one.
        // For existing demo flow, let's assume we find the user by ID or fail.
        let user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        if (!user.walletAddress) {
            return { success: false, error: "User has no wallet address connected" };
        }

        // Calculate premium (Simplified logic for demo)
        const premium = Math.round(coverageAmount * (riskThreshold / 100) * 0.1);

        // 2. DB: Create Pending Policy
        const policy = await prisma.policy.create({
            data: {
                userId: user.id,
                region: locationName,
                coverageAmount: coverageAmount,
                status: 'ACTIVE',
                thresholdRainfall: riskThreshold,
                coordinates: coordinates,
                weatherThumbnail: { cropId },
                premiumDetails: { total: premium, rate: riskThreshold }
            }
        });

        // 3. XRPL: Create Escrow
        const walletResult = getInsurerWallet();
        if ('error' in walletResult) {
            return { success: false, error: walletResult.error };
        }
        const insurerWallet = walletResult.wallet;

        // Use the library function
        const escrowResult = await createConditionalEscrow(
            insurerWallet,
            user.walletAddress,
            coverageAmount,
            60 // 1 minute lock for testing
        );

        console.log(`[CreatePolicy] Escrow Created: ${escrowResult.txHash}`);

        // 4. DB: Update Policy with Escrow Details
        await prisma.policy.update({
            where: { id: policy.id },
            data: {
                xrplEscrowId: escrowResult.txHash,
                escrowSequence: escrowResult.offerSequence,
                escrowCondition: escrowResult.condition,
                escrowFulfillment: escrowResult.fulfillment, // STORE SECRET! In production for demo.
            }
        });

        revalidatePath('/dashboard');
        revalidatePath('/insurer'); // Update insurer dashboard too

        return { success: true, txHash: escrowResult.txHash };
    } catch (error) {
        console.error("[CreatePolicy] Error:", error);
        // Return error message for debugging
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getUserPolicies(userId: string) {
    try {
        const policies = await prisma.policy.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                oracleLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });
        return { success: true, data: policies };
    } catch (error) {
        console.error("[GetUserPolicies] Error:", error);
        return { success: false, error: "Failed to fetch policies" };
    }
}

export async function getDashboardStats(userId: string) {
    // Aggregate stats logic
    try {
        const aggs = await prisma.policy.aggregate({
            where: {
                userId,
                status: 'ACTIVE'
            },
            _sum: {
                coverageAmount: true
            },
            _count: {
                id: true
            }
        });

        const totalCoverage = aggs._sum.coverageAmount?.toNumber() ?? 0;
        const count = aggs._count.id;

        // Simple risk heuristic
        let riskLevel = 'Low';
        if (count > 5 || totalCoverage > 500000) riskLevel = 'Medium';
        if (count > 10 || totalCoverage > 1000000) riskLevel = 'High';

        return {
            totalCoverage,
            riskLevel,
            activeCount: count
        };
    } catch (error) {
        console.error("[GetDashboardStats] Error:", error);
        return { totalCoverage: 0, riskLevel: 'Unknown', activeCount: 0 };
    }
}
