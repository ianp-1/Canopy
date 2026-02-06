'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { PolicyStatus } from '@prisma/client'

/**
 * Get the current authenticated user from Supabase and Prisma
 */
export async function getCurrentUser() {
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
}

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
 * Get dashboard statistics for the current user
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

  const policies = await prisma.policy.findMany({
    where: { userId: user.id },
    select: {
      coverageAmount: true,
      status: true,
    }
  })

  const activePolicies = policies.filter(p => p.status === PolicyStatus.ACTIVE)
  const claimedPolicies = policies.filter(p => p.status === PolicyStatus.CLAIMED)

  const totalCoverage = activePolicies.reduce(
    (sum, p) => sum + Number(p.coverageAmount),
    0
  )

  // Simple risk level calculation
  let riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown' = 'Unknown'
  if (activePolicies.length > 0) {
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
    activePolicies: activePolicies.length,
    claimedPolicies: claimedPolicies.length,
    riskLevel,
  }
}

/**
 * Create a new policy after successful payment
 */
export async function createPolicy(data: {
  premiumAmount: number
  crop: string
  riskLevel: number
  coordinates?: { lat: number; lng: number }
  areaHectares?: number
  txHash: string
}) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // Coverage is typically 10-50x the premium for insurance
  const coverageMultiplier = 20
  const coverageAmount = data.premiumAmount * coverageMultiplier

  // Map crop to region name
  const cropRegionMap: Record<string, string> = {
    corn: 'Corn Belt',
    soy: 'Midwest Soybean',
    wheat: 'Great Plains Wheat',
  }

  const policy = await prisma.policy.create({
    data: {
      userId: user.id,
      region: cropRegionMap[data.crop] || `${data.crop} Field`,
      coverageAmount,
      premiumAmount: data.premiumAmount,
      thresholdRainfall: data.riskLevel, // Risk level as rainfall threshold
      coordinates: data.coordinates,
      premiumDetails: {
        crop: data.crop,
        areaHectares: data.areaHectares,
        txHash: data.txHash,
        paidAt: new Date().toISOString(),
      },
      status: PolicyStatus.ACTIVE,
    }
  })

  return {
    policyId: policy.id,
    coverageAmount: Number(policy.coverageAmount),
  }
}
