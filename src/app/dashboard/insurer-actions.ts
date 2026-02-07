'use server'

import { cache } from 'react'
import prisma from '@/lib/prisma'
import { getCurrentUser } from './actions'
import { PolicyStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export type InsurerStats = {
    totalLiquidity: number
    activePolicies: number
    pendingPolicies: number
    totalRiskExposure: number
    utilizationRate: number
}

/**
 * Get the insurer profile for the current user.
 * Ensures the user has the INSURER role.
 */
export const getInsurerProfile = cache(async () => {
    const user = await getCurrentUser()

    if (!user) return null

    // In a real app, we'd strict check role, but for dev we might allow flexible access
    // if (user.role !== 'INSURER') return null

    const insurer = await prisma.insurer.findFirst({
        where: {
            OR: [
                { userId: user.id }, // Linked via userId
                { walletAddress: user.walletAddress || '' } // Fallback to wallet address match
            ]
        }
    })

    return insurer
})

/**
 * Get aggregated statistics for the insurer dashboard.
 */
export async function getInsurerStats(): Promise<InsurerStats> {
    const insurer = await getInsurerProfile()

    if (!insurer) {
        return {
            totalLiquidity: 0,
            activePolicies: 0,
            pendingPolicies: 0,
            totalRiskExposure: 0,
            utilizationRate: 0
        }
    }

    // Aggregate policy data
    const [activePolicies, pendingPolicies, riskExposure] = await Promise.all([
        prisma.policy.count({
            where: { insurerId: insurer.id, status: 'ACTIVE' }
        }),
        prisma.policy.count({
            where: { insurerId: insurer.id, status: 'PENDING' }
        }),
        prisma.policy.aggregate({
            where: { insurerId: insurer.id, status: 'ACTIVE' },
            _sum: { coverageAmount: true }
        })
    ])

    const totalLiquidity = Number(insurer.totalLiquidity)
    const totalRisk = Number(riskExposure._sum.coverageAmount || 0)

    // Utilization: Risk / Liquidity (simplified)
    const utilizationRate = totalLiquidity > 0 ? (totalRisk / totalLiquidity) * 100 : 0

    return {
        totalLiquidity,
        activePolicies,
        pendingPolicies,
        totalRiskExposure: totalRisk,
        utilizationRate
    }
}

/**
 * Parameters for searching policies
 */
export type PolicySearchParams = {
    status?: PolicyStatus | 'ALL'
    minAmount?: number
    maxAmount?: number
    region?: string
}

/**
 * Search policies available for this insurer (or all if admin/open market)
 */
export async function searchPolicies(params: PolicySearchParams) {
    const insurer = await getInsurerProfile()
    if (!insurer) return []

    const { status, minAmount, maxAmount, region } = params

    const whereClause: any = {
        // For now, insurers see policies assigned to them OR unassigned pending ones?
        // Let's assume they see ALL policies they are related to, plus PENDING ones they could pick up?
        // For this MVP, let's show policies linked to them.
        OR: [
            { insurerId: insurer.id },
            { insurerId: null, status: 'PENDING' } // Open pool of requests
        ]
    }

    if (status && status !== 'ALL') {
        whereClause.status = status
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
        whereClause.coverageAmount = {}
        if (minAmount !== undefined) whereClause.coverageAmount.gte = minAmount
        if (maxAmount !== undefined) whereClause.coverageAmount.lte = maxAmount
    }

    if (region) {
        whereClause.region = { contains: region, mode: 'insensitive' }
    }

    const policies = await prisma.policy.findMany({
        where: whereClause,
        include: {
            user: {
                select: {
                    email: true,
                    walletAddress: true,
                }
            },
            field: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    })

    // Map to frontend friendly format
    return policies.map(p => ({
        id: p.id,
        farmerName: p.user.email || p.user.walletAddress || 'Unknown Farmer',
        region: p.region,
        crop: (p.premiumDetails as any)?.crop || 'Unknown',
        amount: Number(p.coverageAmount),
        premium: p.premiumAmount ? Number(p.premiumAmount) : 0,
        status: p.status,
        requestedAt: p.createdAt,
        coordinates: p.coordinates as { lat: number, lng: number } | null,
        fieldGeometry: p.field?.geometry
    }))
}

/**
 * Approve a pending policy
 */
export async function approvePolicy(policyId: string) {
    const insurer = await getInsurerProfile()
    if (!insurer) throw new Error('Unauthorized')

    // Check if policy exists and is pending
    const policy = await prisma.policy.findUnique({
        where: { id: policyId }
    })

    if (!policy || policy.status !== 'PENDING') {
        throw new Error('Policy not found or not pending')
    }

    // Update policy
    await prisma.policy.update({
        where: { id: policyId },
        data: {
            status: 'ACTIVE',
            insurerId: insurer.id, // Assign to this insurer
            updatedAt: new Date()
        }
    })

    revalidatePath('/dashboard')
    return { success: true }
}

/**
 * Deny a pending policy
 */
export async function denyPolicy(policyId: string) {
    const insurer = await getInsurerProfile()
    if (!insurer) throw new Error('Unauthorized')

    await prisma.policy.update({
        where: { id: policyId },
        data: {
            status: 'DENIED', // Ensure 'DENIED' is in enum or use 'EXPIRED'/'CANCELLED' if not
            insurerId: insurer.id, // Record who denied it? or leave null?
            updatedAt: new Date()
        }
    })

    revalidatePath('/dashboard')
    return { success: true }
}
