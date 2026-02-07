'use server'

import prisma from '@/lib/prisma';
import { InsurerStats } from '@/lib/types/policy-types';

export async function getInsurerStats(): Promise<{ success: boolean; data?: InsurerStats }> {
    try {
        // Aggregate TVL, Counts, etc.
        const activeCount = await prisma.policy.count({
            where: { status: 'ACTIVE' }
        });

        // Mock aggregation for now
        return {
            success: true,
            data: {
                totalValueLocked: 1500000,
                activePolicies: activeCount,
                riskExposure: { high: 5, medium: 20, low: 75 },
                recentLogs: []
            }
        };
    } catch (error) {
        console.error("[GetInsurerStats] Error:", error);
        return { success: false };
    }
}

export async function getOracleLogs() {
    // Fetch recent WeatherLogs
}
