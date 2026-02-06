import { NextResponse } from 'next/server'
import { getXumm } from '@/lib/xumm'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
  }

  try {
    const xumm = getXumm()
    const payload = await xumm.payload?.get(id)

    if (!payload) {
      return NextResponse.json({ signed: false })
    }

    return NextResponse.json({
      signed: payload.meta.signed,
      txid: payload.response.txid
    })

  } catch (error) {
    console.error('Payment Check Error:', error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
