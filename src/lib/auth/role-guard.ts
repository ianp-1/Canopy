'use server'

import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/enums'
import { redirect } from 'next/navigation'

/**
 * Get the current user with their role from the database
 * Returns null if not authenticated
 */
export async function getCurrentUserWithRole() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()

  if (!supabaseUser) return null

  const user = await prisma.user.findUnique({
    where: { supabaseUid: supabaseUser.id },
    select: { id: true, role: true, email: true }
  })

  return user
}

/**
 * Require a specific role to access a resource
 * Redirects to /dashboard if the user doesn't have the required role
 */
export async function requireRole(requiredRole: UserRole) {
  const user = await getCurrentUserWithRole()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== requiredRole && user.role !== 'ADMIN') {
    redirect('/dashboard?error=access_denied')
  }

  return user
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUserWithRole()
  if (!user) return false
  return user.role === role || user.role === 'ADMIN'
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUserWithRole()
  return user?.role === 'ADMIN'
}
