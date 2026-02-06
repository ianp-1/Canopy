/**
 * XRP Premium Payment API
 * Creates a Xaman payment payload for policy premium
 */

import { NextRequest, NextResponse } from 'next/server'
import { Xumm } from 'xumm'
import { xrpToDrops } from 'xrpl'

const xumm = new Xumm(
  process.env.XUMM_API_KEY!,
  process.env.XUMM_API_SECRET
)

// Insurer's wallet receives premium payments
const INSURER_ADDRESS = process.env.INSURER_WALLET_ADDRESS || 'rNmCuyjQCeeQ12e4SgkDg75HTMz8e7DjE'

interface PaymentRequest {
  amountXrp: number
  policyData: {
    crop: string
    riskLevel: number
    coordinates?: { lat: number; lng: number }
    areaHectares?: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PaymentRequest = await request.json()
    const { amountXrp, policyData } = body

    if (!amountXrp || amountXrp <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Convert XRP to drops (1 XRP = 1,000,000 drops)
    const amountDrops = xrpToDrops(amountXrp)

    // Create payment payload with Xaman
    const payload = await xumm.payload?.create({
      TransactionType: 'Payment',
      Destination: INSURER_ADDRESS,
      Amount: amountDrops,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('policy/premium').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              crop: policyData.crop,
              risk: policyData.riskLevel,
              area: policyData.areaHectares,
            })).toString('hex').toUpperCase(),
          }
        }
      ]
    })

    if (!payload) {
      return NextResponse.json({ error: 'Failed to create payment payload' }, { status: 500 })
    }

    // Store policy data temporarily for retrieval on confirmation
    // In production, use a proper session/cache store
    return NextResponse.json({
      success: true,
      qrUrl: payload.refs?.qr_png,
      payloadId: payload.uuid,
      deepLink: payload.next?.always,
      amountXrp,
    })
  } catch (error) {
    console.error('Payment API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
