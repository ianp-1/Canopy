import { NextResponse } from 'next/server'
import { Xumm } from 'xumm'

const xumm = new Xumm(
  process.env.XUMM_API_KEY!,
  process.env.XUMM_API_SECRET
)

export async function POST(request: Request) {
  try {
    const { amount, destination } = await request.json()

    if (!amount || !destination) {
        return NextResponse.json({ error: 'Missing amount or destination' }, { status: 400 })
    }

    // Amount in XRP to Drops? Xaman handles "Amount" as drops if string, or use xrp property?
    // TransactionType: Payment
    // Amount: drops (1 XRP = 1,000,000 drops)
    
    // Let's assume input amount is in XRP.
    const drops = (parseFloat(amount) * 1000000).toString()

    const payload = await xumm.payload?.create({
      TransactionType: 'Payment',
      Destination: destination,
      Amount: drops,
      options: {
        return_url: {
             app: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
             web: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`
        }
      }
    })

    if (!payload) {
        return NextResponse.json({ error: 'Failed to create payload' }, { status: 500 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Payment Create Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
