'use server'

import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { xrpToDrops } from 'xrpl'
import { Xumm } from 'xumm'

// Xumm initialization moved to inside functions

export interface AuthResult {
  success: boolean
  error?: string
  message?: string
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!email || !password) {
    return { success: false, error: 'Email and password are required' }
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Passwords do not match' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (error) return { success: false, error: error.message }
    if (!data.user) return { success: false, error: 'User creation failed' }

    // Create user in Prisma
    await prisma.user.upsert({
      where: { supabaseUid: data.user.id },
      update: { email },
      create: {
        supabaseUid: data.user.id,
        email,
      },
    })

    return {
      success: true,
      message: 'Check your email for the confirmation link.'
    }
  } catch (err) {
    console.error('Sign Up Error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { success: false, error: 'Email and password are required' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Sign In Error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string

  if (!email) {
    return { success: false, error: 'Email is required' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/update-password`,
    })

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      message: 'If an account exists with this email, you will receive a reset link.'
    }
  } catch (err) {
    console.error('Reset Password Error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password) {
    return { success: false, error: 'Password is required' }
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Passwords do not match' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) return { success: false, error: error.message }

    return { success: true, message: 'Password updated successfully' }
  } catch (err) {
    console.error('Update Password Error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function linkWallet(payloadId: string) {

  try {
    // 1. Verify User
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return { success: false, error: 'Unauthorized' }
    }

    // 2. Verify Xaman Payload
    const xumm = new Xumm(
      process.env.XUMM_API_KEY!,
      process.env.XUMM_API_SECRET
    )

    const payload = await xumm.payload?.get(payloadId)
    if (!payload?.meta.signed || !payload.response.account) {
      return { success: false, error: 'Payload not signed or invalid' }
    }

    const walletAddress = payload.response.account

    // 3. Check if wallet already linked to another user
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress },
    })

    if (existingUser && existingUser.supabaseUid !== supabaseUser.id) {
      return { success: false, error: 'Wallet is already linked to another account' }
    }

    // 4. Update User
    await prisma.user.update({
      where: { supabaseUid: supabaseUser.id },
      data: { walletAddress },
    })

    revalidatePath('/account/settings')
    return { success: true, walletAddress }

  } catch (error) {
    console.error('Link Wallet Error:', error)
    return { success: false, error: 'Failed to link wallet' }
  }
}

export async function unlinkWallet() {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return { success: false, error: 'Unauthorized' }
    }

    await prisma.user.update({
      where: { supabaseUid: supabaseUser.id },
      data: { walletAddress: null },
    })

    revalidatePath('/account/settings')
    return { success: true }
  } catch (error) {
    console.error('Unlink Wallet Error:', error)
    return { success: false, error: 'Failed to unlink wallet' }
  }
}

export async function getUserWallet() {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) return null

    const user = await prisma.user.findUnique({
      where: { supabaseUid: supabaseUser.id },
      select: { walletAddress: true }
    })

    return user?.walletAddress || null
  } catch (error) {
    return null
  }
}

export async function setPassword(password: string) {
  try {
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' }
    }

    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update the user's password in Supabase
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error('Set Password Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Set Password Error:', error)
    return { success: false, error: 'Failed to set password' }
  }
}
