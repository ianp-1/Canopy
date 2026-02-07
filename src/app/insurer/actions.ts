'use server'

import prisma from '@/lib/prisma'
import { PolicyStatus } from '@/generated/prisma'

/**
 * Get aggregated statistics for the insurer dashboard
 */
export async function getInsurerStats() {
    // Concurrent fetching for performance
    const [
        activePoliciesCount,
        totalCoverageResult,
        recentPolicies,
        oracleLogs
    ] = await Promise.all([
        // 1. Active Policies Count
        prisma.policy.count({
            where: { status: PolicyStatus.ACTIVE }
        }),

        // 2. Total Value Locked (Sum coverage)
        prisma.policy.aggregate({
            where: { status: PolicyStatus.ACTIVE },
            _sum: {
                coverageAmount: true
            }
        }),

        // 3. Recent Policies for Activity Feed and Map
        prisma.policy.findMany({
            where: { status: PolicyStatus.ACTIVE },
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit for map performance
            select: {
                id: true,
                region: true,
                coordinates: true,
                premiumDetails: true,
                thresholdRainfall: true,
                createdAt: true,
                coverageAmount: true
            }
        }),

        // 4. Recent Oracle Logs
        prisma.oracleLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
                policy: {
                    select: { region: true }
                }
            }
        })
    ])

    // Calculate TVL
    const totalValueLocked = totalCoverageResult._sum.coverageAmount || 0

    // Estimated Risk Calculation (Conservative Model: 5% of TVL)
    // In production, this would be derived from probabilistic weather models
    const projectedPayouts = Number(totalValueLocked) * 0.05

    return {
        activePoliciesCount,
        totalValueLocked: Number(totalValueLocked),
        projectedPayouts,
        recentPolicies,
        oracleLogs,
        // System Status: Assumed healthy if API is responsive
        oracleHealth: 100.0
    }
}

/**
 * Get all pending policies awaiting insurer approval
 */
export async function getPendingPolicies() {
    const policies = await prisma.policy.findMany({
        where: { status: PolicyStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    walletAddress: true
                }
            }
        }
    })

    // Serialize for client component (convert Decimal to number, Date to string)
    return policies.map(policy => ({
        id: policy.id,
        userId: policy.userId,
        region: policy.region,
        coverageAmount: Number(policy.coverageAmount),
        premiumAmount: policy.premiumAmount ? Number(policy.premiumAmount) : null,
        premiumDetails: policy.premiumDetails as Record<string, unknown> | null,
        status: policy.status,
        coordinates: policy.coordinates as { lat: number; lng: number } | null,
        thresholdRainfall: policy.thresholdRainfall,
        createdAt: policy.createdAt.toISOString(),
        expiresAt: policy.expiresAt?.toISOString() ?? null,
        user: policy.user
    }))
}

/**
 * Get count of pending policies for dashboard display
 */
export async function getPendingPoliciesCount() {
    return prisma.policy.count({
        where: { status: PolicyStatus.PENDING }
    })
}

/**
 * Approve a pending policy - changes status to ACTIVE
 */
export async function approvePolicy(policyId: string) {
    try {
        if (!policyId) {
            return { success: false, error: 'Policy ID is required' }
        }

        // Verify policy exists and is PENDING
        const policy = await prisma.policy.findUnique({
            where: { id: policyId }
        })

        if (!policy) {
            return { success: false, error: 'Policy not found' }
        }

        if (policy.status !== PolicyStatus.PENDING) {
            return { success: false, error: `Policy is not pending (current status: ${policy.status})` }
        }

        // Update status to ACTIVE
        await prisma.policy.update({
            where: { id: policyId },
            data: { status: PolicyStatus.ACTIVE }
        })

        // Revalidate relevant paths
        const { revalidatePath } = await import('next/cache')
        revalidatePath('/insurer/approvals')
        revalidatePath('/insurer/dashboard')
        revalidatePath('/insurer/policies')
        revalidatePath('/dashboard')

        return { success: true, message: 'Policy approved successfully' }
    } catch (error) {
        console.error('Approve Policy Error:', error)
        return { success: false, error: 'Failed to approve policy' }
    }
}

/**
 * Deny a pending policy - changes status to DENIED
 */
export async function denyPolicy(policyId: string, reason?: string) {
    try {
        if (!policyId) {
            return { success: false, error: 'Policy ID is required' }
        }

        // Verify policy exists and is PENDING
        const policy = await prisma.policy.findUnique({
            where: { id: policyId }
        })

        if (!policy) {
            return { success: false, error: 'Policy not found' }
        }

        if (policy.status !== PolicyStatus.PENDING) {
            return { success: false, error: `Policy is not pending (current status: ${policy.status})` }
        }

        // Update status to DENIED
        // Note: Could store denial reason in premiumDetails or a new field if needed
        await prisma.policy.update({
            where: { id: policyId },
            data: { status: PolicyStatus.DENIED }
        })

        // Revalidate relevant paths
        const { revalidatePath } = await import('next/cache')
        revalidatePath('/insurer/approvals')
        revalidatePath('/insurer/dashboard')
        revalidatePath('/insurer/policies')
        revalidatePath('/dashboard')

        return { success: true, message: 'Policy denied' }
    } catch (error) {
        console.error('Deny Policy Error:', error)
        return { success: false, error: 'Failed to deny policy' }
    }
}

/**
 * Get all policies for the registry
 */
export async function getAllPolicies() {
    const policies = await prisma.policy.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    walletAddress: true
                }
            },
            oracleLogs: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    })

    return policies.map(policy => ({
        id: policy.id,
        userId: policy.userId,
        region: policy.region,
        coverageAmount: Number(policy.coverageAmount),
        premiumAmount: policy.premiumAmount ? Number(policy.premiumAmount) : null,
        premiumDetails: policy.premiumDetails as Record<string, unknown> | null,
        status: policy.status,
        coordinates: policy.coordinates as { lat: number; lng: number } | null,
        thresholdRainfall: policy.thresholdRainfall,
        createdAt: policy.createdAt.toISOString(),
        expiresAt: policy.expiresAt?.toISOString() ?? null,
        updatedAt: policy.updatedAt.toISOString(),
        user: policy.user,
        xrplEscrowId: policy.xrplEscrowId,
        nftTokenId: policy.nftTokenId,
        escrowAddress: policy.escrowCondition ? 'Condition exists' : null, // Simplified for now
        weatherData: policy.oracleLogs[0]?.weatherData as any,
        oracleLastCheck: policy.oracleLogs[0]?.createdAt.toISOString(),
    }))
}
