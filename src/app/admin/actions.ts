'use server'

import prisma from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/enums'
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
