'use server'

import prisma from '@/lib/prisma'
import { PolicyStatus } from '@prisma/client'

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

    // Mock calculation for Projected Payouts (e.g., 5% of TVL)
    const projectedPayouts = Number(totalValueLocked) * 0.05

    return {
        activePoliciesCount,
        totalValueLocked: Number(totalValueLocked),
        projectedPayouts,
        recentPolicies,
        oracleLogs,
        // Oracle health is mocked for now as we don't have a health check table
        oracleHealth: 99.9
    }
}
