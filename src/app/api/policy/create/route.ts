/**
 * Create Policy API
 * Called after successful payment confirmation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPolicy } from '@/app/dashboard/actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { premiumAmount, crop, riskLevel, coordinates, areaHectares, txHash } = body

    if (!txHash || !premiumAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await createPolicy({
      premiumAmount,
      crop,
      riskLevel,
      coordinates,
      areaHectares,
      txHash,
    })

    return NextResponse.json({
      success: true,
      policyId: result.policyId,
      coverageAmount: result.coverageAmount,
    })
  } catch (error) {
    console.error('Create Policy Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    }, { status: 500 })
  }
}
