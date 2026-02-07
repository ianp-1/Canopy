'use server'

import prisma from '@/lib/prisma'
import { UserRole } from '@/generated/prisma'
import { requireRole } from '@/lib/auth/role-guard'
import { revalidatePath } from 'next/cache'

export interface UserListItem {
  id: string
  email: string | null
  role: UserRole
  createdAt: Date
  walletAddress: string | null
}

/**
 * Get all users with pagination (admin only)
 */
export async function getAllUsers(page = 1, limit = 20): Promise<{ users: UserListItem[], total: number }> {
  await requireRole('ADMIN')

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        walletAddress: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count(),
  ])

  return { users, total }
}

/**
 * Update a user's role (admin only)
 */
export async function updateUserRole(userId: string, newRole: UserRole) {
  await requireRole('ADMIN')

  if (!['USER', 'INSURER', 'ADMIN'].includes(newRole)) {
    return { success: false, error: 'Invalid role' }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Update User Role Error:', error)
    return { success: false, error: 'Failed to update user role' }
  }
}

/**
 * Get all policies with pagination and filtering (admin only)
 */
export async function getAllPolicies(
  page = 1,
  limit = 20,
  search?: string,
  status?: string
) {
  await requireRole('ADMIN')

  const where: any = {}

  // Filter by status if provided and not 'ALL'
  if (status && status !== 'ALL') {
    where.status = status
  }

  // Search by ID or User Email
  if (search) {
    where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } }
    ]
  }

  const [policies, total] = await Promise.all([
    prisma.policy.findMany({
      where,
      include: {
        user: {
          select: { email: true, walletAddress: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.policy.count({ where }),
  ])

  // Calculate aggregate stats for these policies
  const totalCoverage = policies.reduce((sum: number, p: any) => sum + Number(p.coverageAmount), 0)
  const totalPremium = policies.reduce((sum: number, p: any) => sum + (p.premiumAmount ? Number(p.premiumAmount) : 0), 0)

  return {
    policies,
    total,
    stats: {
      totalCoverage,
      totalPremium
    }
  }
}

/**
 * System Health Metrics
 */
export interface SystemHealth {
  status: 'operational' | 'degraded' | 'maintenance'
  lastSync: Date | null
  activeNodes: number
  recentErrors: number
  totalActions24h: number
}

export async function getSystemHealth(): Promise<SystemHealth> {
  await requireRole('ADMIN')

  try {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Parallel fetch for efficiency
    const [lastLog, errorCount, actionCount] = await Promise.all([
      prisma.oracleLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
      prisma.oracleLog.count({
        where: {
          createdAt: { gte: yesterday },
          errorMessage: { not: null }
        }
      }),
      prisma.oracleLog.count({
        where: {
          createdAt: { gte: yesterday }
        }
      })
    ])

    // Determine status based on recency of last log (e.g., > 1 hour = degraded)
    let status: SystemHealth['status'] = 'operational'
    if (!lastLog || (now.getTime() - lastLog.createdAt.getTime() > 60 * 60 * 1000)) {
      status = 'degraded'
    }

    return {
      status,
      lastSync: lastLog?.createdAt || null,
      activeNodes: 3, // Hardcoded for this phase (OpenWeather, AccuWeather, NOAA)
      recentErrors: errorCount,
      totalActions24h: actionCount
    }
  } catch (error) {
    console.error('Failed to fetch system health:', error)
    throw new Error('Failed to fetch system health')
  }
}

/**
 * Get paginated Oracle Logs
 */
export async function getOracleLogs(page = 1, limit = 20) {
  await requireRole('ADMIN')

  try {
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.oracleLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          policy: {
            select: {
              id: true,
              user: {
                select: { email: true }
              }
            }
          }
        }
      }),
      prisma.oracleLog.count()
    ])

    return {
      logs,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    }
  } catch (error) {
    console.error('Failed to fetch oracle logs:', error)
    throw new Error('Failed to fetch oracle logs')
  }
}
