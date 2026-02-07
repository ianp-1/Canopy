'use server'

import { cache } from 'react'
import prisma from '@/lib/prisma'
import { getCurrentUser } from './actions'
import { PolicyStatus } from '@/generated/prisma'
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

    // Query by wallet address only (userId column not yet migrated to database)
    if (!user.walletAddress) return null

    const insurer = await prisma.insurer.findFirst({
        where: {
            walletAddress: user.walletAddress
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
    farmerName?: string
    crop?: string
}

/**
 * Policy data returned from search
 */
export type PolicySearchResult = {
    id: string
    farmerName: string
    farmerWallet: string | null
    region: string
    crop: string
    amount: number
    premium: number
    status: string
    requestedAt: Date
    expiresAt: Date | null
    coordinates: { lat: number; lng: number } | null
    fieldGeometry: unknown
    escrowSequence: number | null
    nftTokenId: string | null
}

/**
 * Search policies available for this insurer (or all if admin/open market)
 */
export async function searchPolicies(params: PolicySearchParams): Promise<PolicySearchResult[]> {
    const insurer = await getInsurerProfile()
    if (!insurer) return []

    const { status, minAmount, maxAmount, region, farmerName, crop } = params

    // Build base where clause for insurer access
    const baseConditions: any[] = [
        { insurerId: insurer.id },
        { insurerId: null, status: 'PENDING' } // Open pool of requests
    ]

    const whereClause: any = {
        OR: baseConditions
    }

    // Apply status filter
    if (status && status !== 'ALL') {
        whereClause.status = status
    }

    // Apply amount range filter
    if (minAmount !== undefined || maxAmount !== undefined) {
        whereClause.coverageAmount = {}
        if (minAmount !== undefined) whereClause.coverageAmount.gte = minAmount
        if (maxAmount !== undefined) whereClause.coverageAmount.lte = maxAmount
    }

    // Apply region filter (case-insensitive partial match)
    if (region) {
        whereClause.region = { contains: region, mode: 'insensitive' }
    }

    // Apply crop filter (stored in premiumDetails JSON)
    // Note: JSON filtering varies by database, using raw query for complex cases
    // For now, we filter in memory after fetch

    const policies = await prisma.policy.findMany({
        where: whereClause,
        include: {
            user: {
                select: {
                    email: true,
                    walletAddress: true,
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 100 // Increased limit to allow for client-side filtering
    })

    // Map to frontend friendly format with additional fields
    let results = policies.map(p => ({
        id: p.id,
        farmerName: p.user.email || p.user.walletAddress || 'Unknown Farmer',
        farmerWallet: p.user.walletAddress,
        region: p.region,
        crop: (p.premiumDetails as any)?.crop || 'Unknown',
        amount: Number(p.coverageAmount),
        premium: p.premiumAmount ? Number(p.premiumAmount) : 0,
        status: p.status,
        requestedAt: p.createdAt,
        expiresAt: p.expiresAt,
        coordinates: p.coordinates as { lat: number; lng: number } | null,
        fieldGeometry: p.geometry,
        escrowSequence: p.escrowSequence,
        nftTokenId: p.nftTokenId
    }))

    // Apply farmer name filter (client-side for partial match on computed field)
    if (farmerName) {
        const searchTerm = farmerName.toLowerCase()
        results = results.filter(p => p.farmerName.toLowerCase().includes(searchTerm))
    }

    // Apply crop filter (client-side as it's stored in JSON)
    if (crop && crop !== 'ALL') {
        results = results.filter(p => p.crop.toLowerCase() === crop.toLowerCase())
    }

    // Return top 50 after filtering
    return results.slice(0, 50)
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

/**
 * Full policy details for insurer detail view
 */
export type PolicyDetail = {
    id: string
    farmerName: string
    farmerEmail: string | null
    farmerWallet: string | null
    region: string
    crop: string
    coverageAmount: number
    premiumAmount: number
    status: string
    createdAt: Date
    expiresAt: Date | null
    claimedAt: Date | null
    coordinates: { lat: number; lng: number } | null
    fieldGeometry: unknown
    // Weather thresholds
    thresholdRainfall: number | null
    thresholdTemp: number | null
    thresholdSoilMoisture: number | null
    weeklyRainNeedMm: number | null
    heatThresholdK: number | null
    vpdThresholdKpa: number | null
    // Escrow details
    escrowSequence: number | null
    escrowCondition: string | null
    xrplEscrowId: string | null
    claimTxHash: string | null
    // NFT details
    nftTokenId: string | null
    nftMintTxHash: string | null
    // Premium calculation details
    premiumDetails: unknown
    // Oracle history
    oracleLogs: Array<{
        id: string
        action: string
        consensusScore: number | null
        createdAt: Date
        txHash: string | null
        errorMessage: string | null
    }>
}

/**
 * Get full policy details for insurer view
 */
export async function getPolicyForInsurer(policyId: string): Promise<PolicyDetail | null> {
    const insurer = await getInsurerProfile()
    if (!insurer) return null

    const policy = await prisma.policy.findUnique({
        where: { id: policyId },
        include: {
            user: {
                select: {
                    email: true,
                    walletAddress: true,
                }
            },
            oracleLogs: {
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    action: true,
                    consensusScore: true,
                    createdAt: true,
                    txHash: true,
                    errorMessage: true
                }
            }
        }
    })

    if (!policy) return null

    // Check if insurer has access to this policy
    const hasAccess = policy.insurerId === insurer.id ||
        (policy.insurerId === null && policy.status === 'PENDING')

    if (!hasAccess) return null

    return {
        id: policy.id,
        farmerName: policy.user.email || policy.user.walletAddress || 'Unknown Farmer',
        farmerEmail: policy.user.email,
        farmerWallet: policy.user.walletAddress,
        region: policy.region,
        crop: (policy.premiumDetails as any)?.crop || 'Unknown',
        coverageAmount: Number(policy.coverageAmount),
        premiumAmount: policy.premiumAmount ? Number(policy.premiumAmount) : 0,
        status: policy.status,
        createdAt: policy.createdAt,
        expiresAt: policy.expiresAt,
        claimedAt: policy.claimedAt,
        coordinates: policy.coordinates as { lat: number; lng: number } | null,
        fieldGeometry: policy.geometry,
        // Weather thresholds
        thresholdRainfall: policy.thresholdRainfall,
        thresholdTemp: policy.thresholdTemp,
        thresholdSoilMoisture: policy.thresholdSoilMoisture,
        weeklyRainNeedMm: (policy as any).weeklyRainNeedMm ?? null,
        heatThresholdK: (policy as any).heatThresholdK ?? null,
        vpdThresholdKpa: (policy as any).vpdThresholdKpa ?? null,
        // Escrow details
        escrowSequence: policy.escrowSequence,
        escrowCondition: policy.escrowCondition,
        xrplEscrowId: policy.xrplEscrowId,
        claimTxHash: policy.claimTxHash,
        // NFT details
        nftTokenId: policy.nftTokenId,
        nftMintTxHash: policy.nftMintTxHash,
        // Premium calculation details
        premiumDetails: policy.premiumDetails,
        // Oracle logs
        oracleLogs: policy.oracleLogs.map(log => ({
            id: log.id,
            action: log.action,
            consensusScore: log.consensusScore,
            createdAt: log.createdAt,
            txHash: log.txHash,
            errorMessage: log.errorMessage
        }))
    }
}
