import { NextResponse } from 'next/server'
import { Xumm } from 'xumm'
import jwt from 'jsonwebtoken'
import { createAdminClient } from '@/lib/supabase/admin'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=Service Unavailable`)
  }

  const xumm = new Xumm(
    process.env.XUMM_API_KEY,
    process.env.XUMM_API_SECRET
  )
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
  }

  try {
    const payload = await xumm.payload?.get(id)

    if (!payload || !payload.meta.signed) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=Verification Failed`)
    }

    const walletAddress = payload.response.account
    if (!walletAddress) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=No Account Found`)
    }

    const supabaseAdmin = createAdminClient()
    const email = `${walletAddress}@xaman.local`

    let userId: string | null = null;

    // Check Prisma first for speed and accuracy
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress }
    })

    if (existingUser) {
      userId = existingUser.supabaseUid
    } else {
      // Create in Supabase
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { wallet_address: walletAddress }
      })

      if (createError) {
        // Fallback: User might exist in Supabase but not Prisma (desync)
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const found = users.find(u => u.email === email)
        if (found) userId = found.id
      } else {
        userId = newUser.user.id
      }
    }

    if (!userId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=User Creation Failed`)
    }

    // Sync with Prisma
    await prisma.user.upsert({
      where: { walletAddress },
      update: { supabaseUid: userId },
      create: {
        walletAddress,
        supabaseUid: userId
      }
    })

    const token = jwt.sign({
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      sub: userId,
      email: email,
      role: 'authenticated',
      app_metadata: { provider: 'xaman', providers: ['xaman'] },
      user_metadata: { wallet_address: walletAddress }
    }, process.env.SUPABASE_JWT_SECRET!)

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/xaman-confirm?token=${token}`)

  } catch (error) {
    console.error('Xaman Verify Error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=Verification Exception`)
  }
}
