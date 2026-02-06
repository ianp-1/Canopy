/**
 * XRP Payment Status Check API
 * Polls Xaman for payment confirmation
 */

import { NextRequest, NextResponse } from 'next/server'
import { Xumm } from 'xumm'

const xumm = new Xumm(
  process.env.XUMM_API_KEY!,
  process.env.XUMM_API_SECRET
)

export async function GET(request: NextRequest) {
  try {
    const payloadId = request.nextUrl.searchParams.get('id')

    if (!payloadId) {
      return NextResponse.json({ error: 'Missing payload ID' }, { status: 400 })
    }

    // Get payload status from Xaman
    const payload = await xumm.payload?.get(payloadId)

    if (!payload) {
      return NextResponse.json({ error: 'Payload not found' }, { status: 404 })
    }

    // Check if signed
    if (payload.meta.signed) {
      // Payment was approved
      const txHash = payload.response.txid
      const account = payload.response.account

      // TODO: Create policy record in database
      // const policy = await createPolicy({ ... })

      return NextResponse.json({
        signed: true,
        txHash,
        account,
        // policyId: policy.id,  // From database
        dispatchedResult: payload.response.dispatched_result,
      })
    }

    // Check if rejected or expired
    if (payload.meta.resolved && !payload.meta.signed) {
      return NextResponse.json({
        signed: false,
        rejected: true,
        expired: payload.meta.expired,
      })
    }

    // Still pending
    return NextResponse.json({
      pending: true,
      opened: payload.meta.app_opened,
    })
  } catch (error) {
    console.error('Payment Check Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
