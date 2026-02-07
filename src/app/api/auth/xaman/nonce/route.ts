import { NextResponse } from 'next/server'
import { getXumm } from '@/lib/xumm'

export async function POST() {
  try {
    const xumm = getXumm()
    const payload = await xumm.payload?.create({
      TransactionType: 'SignIn',
      options: {
        return_url: {
          app: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/xaman/verify?id={id}`,
          web: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/xaman/verify?id={id}`
        }
      }
    })

    if (!payload) {
      return NextResponse.json({ error: 'Failed to create payload' }, { status: 500 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Xaman Nonce Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
