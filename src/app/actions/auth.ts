'use server'

import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { xrpToDrops } from 'xrpl'
import { Xumm } from 'xumm'

const xumm = new Xumm(
  process.env.XUMM_API_KEY!,
  process.env.XUMM_API_SECRET
)

export async function linkWallet(payloadId: string) {
  try {
    // 1. Verify User
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return { success: false, error: 'Unauthorized' }
    }

    // 2. Verify Xaman Payload
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
