'use server'

import prisma from '@/lib/prisma';

export async function getPolicyDetails(policyId: string) {
    try {
        const policy = await prisma.policy.findUnique({
            where: { id: policyId },
            include: {
                oracleLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!policy) return { success: false, error: "Policy not found" };

        return { success: true, data: policy };
    } catch (error) {
        console.error("[GetPolicyDetails] Error:", error);
        return { success: false, error: "Failed to fetch policy details" };
    }
}
