'use server'

import { verifyNFTOwnership } from '@/app/actions/payment'
import { cache } from 'react'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { PolicyStatus } from '@/generated/prisma/client'

/**
 * Get the current authenticated user from Supabase and Prisma.
 * Wrapped with React `cache()` to deduplicate calls within a single request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  
  if (!supabaseUser) {
    return null
  }
  
  // Get or create Prisma user
  let user = await prisma.user.findUnique({
    where: { supabaseUid: supabaseUser.id }
  })
  
  if (!user) {
    // Create user on first access
    user = await prisma.user.create({
      data: {
        supabaseUid: supabaseUser.id,
        email: supabaseUser.email,
      }
    })
  }
  
  return {
    id: user.id,
    supabaseUid: user.supabaseUid,
    email: user.email,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt,
  }
})

/**
 * Get all policies for the current user
 */
export async function getUserPolicies() {
  const user = await getCurrentUser()
  
  if (!user) {
    return []
  }
  
  const policies = await prisma.policy.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  
  return policies.map(policy => ({
    id: policy.id,
    region: policy.region,
    coverageAmount: Number(policy.coverageAmount),
    premiumAmount: policy.premiumAmount ? Number(policy.premiumAmount) : null,
    status: policy.status,
    createdAt: policy.createdAt,
    coordinates: policy.coordinates as { lat: number; lng: number } | null,
    thresholdRainfall: policy.thresholdRainfall,
    claimedAt: policy.claimedAt,
    claimTxHash: policy.claimTxHash,
    premiumDetails: policy.premiumDetails as { crop?: string; areaHectares?: number; txHash?: string } | null,
  }))
}

/**
 * Get dashboard statistics for the current user.
 * Uses Prisma aggregations for efficiency instead of fetching all records.
 */
export async function getDashboardStats() {
  const user = await getCurrentUser()
  
  if (!user) {
    return {
      totalCoverage: 0,
      activePolicies: 0,
      claimedPolicies: 0,
      riskLevel: 'Unknown' as const,
    }
  }
  
  // Use aggregations instead of fetching all rows
  const [activeAgg, claimedCount] = await Promise.all([
    prisma.policy.aggregate({
      where: { userId: user.id, status: PolicyStatus.ACTIVE },
      _sum: { coverageAmount: true },
      _count: true,
    }),
    prisma.policy.count({
      where: { userId: user.id, status: PolicyStatus.CLAIMED },
    }),
  ])
  
  const totalCoverage = Number(activeAgg._sum.coverageAmount ?? 0)
  const activePolicies = activeAgg._count
  
  // Simple risk level calculation
  let riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown' = 'Unknown'
  if (activePolicies > 0) {
    if (totalCoverage > 100000) {
      riskLevel = 'High'
    } else if (totalCoverage > 50000) {
      riskLevel = 'Medium'
    } else {
      riskLevel = 'Low'
    }
  }
  
  return {
    totalCoverage,
    activePolicies,
    claimedPolicies: claimedCount,
    riskLevel,
  }
}


/**
 * Get detailed policy information by ID
 * Verifies the current user owns the policy
 */
export async function getPolicyDetails(policyId: string) {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }
  
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    include: {
      oracleLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
  
  // Verify ownership
  if (!policy || policy.userId !== user.id) {
    return null
  }
  
  const premiumDetails = policy.premiumDetails as {
    crop?: string
    areaHectares?: number
    premiumTxHash?: string
    nftOfferTxHash?: string
    nftOfferId?: string
    activatedAt?: string
  } | null
  
  // Check if user actually owns the NFT on-chain
  let isNftClaimed = false
  if (policy.nftTokenId && user.walletAddress) {
    isNftClaimed = await verifyNFTOwnership(user.walletAddress, policy.nftTokenId)
  }
  
  return {
    // ... existing fields ...
    id: policy.id,
    region: policy.region,
    coverageAmount: Number(policy.coverageAmount),
    premiumAmount: policy.premiumAmount ? Number(policy.premiumAmount) : null,
    status: policy.status,
    createdAt: policy.createdAt,
    expiresAt: policy.expiresAt,
    
    // Coordinates & Weather Config
    coordinates: policy.coordinates as { lat: number; lng: number } | null,
    thresholdRainfall: policy.thresholdRainfall,
    
    // XRPL Escrow data
    escrowSequence: policy.escrowSequence,
    xrplEscrowId: policy.xrplEscrowId,
    
    // NFT data
    nftTokenId: policy.nftTokenId,
    nftMintTxHash: policy.nftMintTxHash,
    isNftClaimed, // New field
    
    // ... rest of the return object
    claimedAt: policy.claimedAt,
    claimTxHash: policy.claimTxHash,
    
    premiumDetails,
    
    oracleLogs: policy.oracleLogs.map(log => ({
      id: log.id,
      action: log.action,
      txHash: log.txHash,
      createdAt: log.createdAt,
      consensusScore: log.consensusScore,
    })),
  }
}
