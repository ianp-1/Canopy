import { NextResponse } from 'next/server'
import { Xumm } from 'xumm'
import { createAdminClient } from '@/lib/supabase/admin'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
    const xumm = new Xumm(
        process.env.XUMM_API_KEY!,
        process.env.XUMM_API_SECRET
    )
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
    }

    try {
        const payload = await xumm.payload?.get(id)

        if (!payload) {
            return NextResponse.json({ signed: false })
        }

        if (!payload.meta.signed) {
            return NextResponse.json({ signed: false })
        }

        // It is signed!
        const walletAddress = payload.response.account
        if (!walletAddress) {
            return NextResponse.json({ error: 'No Account' }, { status: 500 })
        }

        // Find/create user in Supabase Auth
        const supabaseAdmin = createAdminClient()
        const email = `${walletAddress}@xaman.local`
        let userId: string | null = null;

        // Check if user exists in our database
        const existingUser = await prisma.user.findUnique({ where: { walletAddress } })

        if (existingUser) {
            userId = existingUser.supabaseUid
        } else {
            // Create user in Supabase Auth
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                email_confirm: true,
                user_metadata: { wallet_address: walletAddress }
            })

            if (createError) {
                // User might already exist in Supabase - try to find them
                const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
                const found = users.find(u => u.email === email)
                if (found) userId = found.id
            } else {
                userId = newUser.user.id
            }
        }

        if (!userId) {
            return NextResponse.json({ error: 'User Failed' }, { status: 500 })
        }

        // Upsert user in our database
        await prisma.user.upsert({
            where: { walletAddress },
            update: { supabaseUid: userId },
            create: { walletAddress, supabaseUid: userId }
        })

        // Generate a magic link for the user (Supabase signs this with ES256)
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
            }
        })

        if (linkError || !linkData) {
            console.error('Generate link error:', linkError)
            return NextResponse.json({ error: 'Link generation failed' }, { status: 500 })
        }

        // Extract the token_hash from the link for PKCE flow
        const url = new URL(linkData.properties.action_link)
        const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')

        return NextResponse.json({
            signed: true,
            magicLink: linkData.properties.action_link,
            tokenHash: tokenHash,
            type: 'magiclink'
        })

    } catch (error) {
        console.error('Xaman Check Error:', error)
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
    }
}
