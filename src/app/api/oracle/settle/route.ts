/**
 * Oracle Settlement API
 *
 * Settles a single policy by executing EscrowFinish on the XRPL.
 * This endpoint is called by the AI agent's settle node after the ML model
 * and verification steps have already confirmed the payout should proceed.
 *
 * The existing cron job (`/api/cron/oracle`) handles batch processing of all
 * active policies. This endpoint handles targeted, agent-initiated settlement
 * for a specific policy that has already been evaluated.
 *
 * @route POST /api/oracle/settle
 *
 * Security: Protected by CRON_SECRET header (same as cron endpoint)
 */

import { NextRequest, NextResponse } from 'next/server'
import { Wallet } from 'xrpl'
import prisma from '@/lib/prisma'
import { sendRlusdPayout } from '@/lib/xrpl'
import { PolicyStatus, OracleAction } from '@/generated/prisma/client'

const CRON_SECRET = process.env.CRON_SECRET
const INSURER_SEED = process.env.XRPL_INSURER_SEED

interface SettleRequest {
  policyId: string
  agentConfidence?: number
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!INSURER_SEED) {
      return NextResponse.json(
        { error: 'Server configuration error: XRPL_INSURER_SEED not set' },
        { status: 500 }
      )
    }

    // 2. Parse Request
    const body: SettleRequest = await request.json()
    const { policyId, agentConfidence } = body

    if (!policyId) {
      return NextResponse.json(
        { error: 'policyId is required' },
        { status: 400 }
      )
    }

    console.log(`🤖 Agent-initiated settlement for policy ${policyId}`)

    // 3. Look up policy
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { user: true },
    })

    if (!policy) {
      return NextResponse.json(
        { error: `Policy ${policyId} not found` },
        { status: 404 }
      )
    }

    if (policy.status !== PolicyStatus.ACTIVE) {
      return NextResponse.json(
        { error: `Policy ${policyId} is not ACTIVE (status: ${policy.status})` },
        { status: 409 }
      )
    }

    if (!policy.escrowCondition || !policy.escrowFulfillment) {
      return NextResponse.json(
        { error: `Policy ${policyId} is missing commitment data` },
        { status: 422 }
      )
    }

    const farmerAddress = policy.user?.walletAddress
    if (!farmerAddress) {
      return NextResponse.json(
        { error: `Policy ${policyId} farmer has no wallet address` },
        { status: 422 }
      )
    }

    // 4. Execute RLUSD Payout
    const insurerWallet = Wallet.fromSeed(INSURER_SEED)

    console.log(`   ⚡ Executing RLUSD payout...`)
    console.log(`   Amount: ${Number(policy.coverageAmount)} RLUSD`)

    const payoutResult = await sendRlusdPayout(
      insurerWallet,
      farmerAddress,
      Number(policy.coverageAmount),
    )

    if (!payoutResult.success) {
      await prisma.oracleLog.create({
        data: {
          policyId: policy.id,
          action: OracleAction.PAYOUT_FAILED,
          errorMessage: `RLUSD payout failed: tx ${payoutResult.txHash}`,
          weatherData: { source: 'agent', agentConfidence },
        },
      })

      return NextResponse.json(
        {
          success: false,
          policyId: policy.id,
          error: 'RLUSD payout transaction failed',
          txHash: payoutResult.txHash,
        },
        { status: 502 }
      )
    }

    console.log(`   ✅ Payout successful: ${payoutResult.txHash}`)

    // 5. Update Policy Status
    await prisma.policy.update({
      where: { id: policy.id },
      data: {
        status: PolicyStatus.CLAIMED,
        claimedAt: new Date(),
        claimTxHash: payoutResult.txHash,
      },
    })

    // 6. Log Oracle Action
    await prisma.oracleLog.create({
      data: {
        policyId: policy.id,
        action: OracleAction.PAYOUT_SUCCESS,
        txHash: payoutResult.txHash,
        weatherData: { source: 'agent', agentConfidence },
        consensusScore: agentConfidence,
      },
    })

    return NextResponse.json({
      success: true,
      policyId: policy.id,
      txHash: payoutResult.txHash,
      settled: true,
    })
  } catch (error) {
    console.error('Settlement Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
