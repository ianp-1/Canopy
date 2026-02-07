/**
 * Oracle Cron Job API — Pavilion Agent Monitoring
 * 
 * Monitors active policies using the Pavilion AI agent's LangGraph
 * monitoring pipeline (monitor → verify → settle).  Replaces simple
 * ML threshold checks with multimodal data fusion across weather,
 * storm events, satellite NDVI, and ML risk.
 * 
 * @route POST /api/cron/oracle
 * 
 * Security: Protected by CRON_SECRET header
 * 
 * How it works:
 * 1. Fetch all ACTIVE policies with commitment data
 * 2. For each policy, call the Pavilion agent's monitoring graph
 * 3. The agent decides: SAFE (continue) / TRIGGER → VERIFY → SETTLE
 * 4. If settled, agent executes RLUSD payout via /api/oracle/settle
 * 5. Update policy status and log results to OracleLog table
 */

import { NextRequest, NextResponse } from 'next/server'
import { Wallet } from 'xrpl'
import prisma from '@/lib/prisma'
import { sendRlusdPayout } from '@/lib/xrpl'
import { PolicyStatus, OracleAction } from '@/generated/prisma'

// Environment
const CRON_SECRET = process.env.CRON_SECRET
const INSURER_SEED = process.env.XRPL_INSURER_SEED
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. Security Check
    // ═══════════════════════════════════════════════════════════════════

    const authHeader = request.headers.get('authorization')


    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!INSURER_SEED) {
      return NextResponse.json({
        error: 'Server configuration error: XRPL_INSURER_SEED not set'
      }, { status: 500 })
    }

    const insurerWallet = Wallet.fromSeed(INSURER_SEED)

    console.log('🔮 Pavilion Agent Cron Job Started')
    console.log(`   Insurer Wallet: ${insurerWallet.address}`)

    // ═══════════════════════════════════════════════════════════════════
    // 1.5. Handle Expirations
    // ═══════════════════════════════════════════════════════════════════

    const expiredUpdate = await prisma.policy.updateMany({
      where: {
        status: PolicyStatus.ACTIVE,
        expiresAt: {
          lt: new Date()
        }
      },
      data: {
        status: PolicyStatus.EXPIRED
      }
    })

    if (expiredUpdate.count > 0) {
      console.log(`   🕒 Expired ${expiredUpdate.count} policies`)
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. Fetch Active Policies with commitment data
    // ═══════════════════════════════════════════════════════════════════

    // Filter for policies that have commitment data (escrowFulfillment is retained
    // for audit trail even though RLUSD payouts use direct Payment instead of EscrowFinish)
    const policies = await prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        escrowFulfillment: { not: null },
      },
      include: {
        user: true,
      }
    })

    console.log(`   Found ${policies.length} active policies to check`)

    if (policies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active policies to process',
        processed: 0,
        triggered: 0,
      })
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. Process Each Policy via Pavilion Agent
    // ═══════════════════════════════════════════════════════════════════

    const results: Array<{
      policyId: string
      triggered: boolean
      reason: string
      severity?: number
      txHash?: string
      agentStatus?: string
    }> = []

    for (const policy of policies) {
      console.log(`\n📋 Processing Policy ${policy.id}`)

      try {
        const coords = policy.coordinates as { lat: number; lng: number } | null
        const premiumDetails = policy.premiumDetails as Record<string, unknown> | null

        if (!coords) {
          console.log(`   ⚠️ No coordinates found, skipping`)
          results.push({
            policyId: policy.id,
            triggered: false,
            reason: 'No coordinates available for evaluation',
          })
          continue
        }

        // ═══════════════════════════════════════════════════════════════
        // 3a. Call Pavilion Agent's Monitoring Graph
        // ═══════════════════════════════════════════════════════════════

        console.log(`   🤖 Pavilion agent monitoring...`)

        const cropType = (premiumDetails?.crop as string) || 'corn'
        const coverageRlusd = Number(policy.coverageAmount) || 1000

        const agentResponse = await fetch(`${BACKEND_URL}/agent/monitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policy_id: policy.id,
            latitude: coords.lat,
            longitude: coords.lng,
            crop_type: cropType,
            coverage_rlusd: coverageRlusd,
          }),
        })

        if (!agentResponse.ok) {
          const errorText = await agentResponse.text()
          console.log(`   ⚠️ Agent monitoring failed: ${errorText}`)
          results.push({
            policyId: policy.id,
            triggered: false,
            reason: `Agent error: ${errorText}`,
          })
          continue
        }

        const agentResult = await agentResponse.json()
        const agentStatus = agentResult.status
        const riskScore = agentResult.risk_score || 0
        const reasoningLog = agentResult.reasoning_log || []

        console.log(`   Agent status: ${agentStatus}`)
        console.log(`   Risk score: ${(riskScore * 100).toFixed(1)}%`)

        if (agentStatus === 'settled' && agentResult.transaction_hash) {
          // ═══════════════════════════════════════════════════════════
          // Agent already executed RLUSD payout via its settle node
          // ═══════════════════════════════════════════════════════════

          console.log(`   ✅ Agent settled! TX: ${agentResult.transaction_hash}`)

          await prisma.policy.update({
            where: { id: policy.id },
            data: {
              status: PolicyStatus.CLAIMED,
              claimedAt: new Date(),
              claimTxHash: agentResult.transaction_hash,
            }
          })

          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.PAYOUT_SUCCESS,
              txHash: agentResult.transaction_hash,
              consensusScore: riskScore,
              weatherData: {
                agentName: 'Pavilion',
                agentStatus,
                reasoning_log: reasoningLog,
                source: 'agent_monitoring_graph',
              },
            }
          })

          results.push({
            policyId: policy.id,
            triggered: true,
            severity: riskScore,
            reason: `Pavilion agent settled — risk ${(riskScore * 100).toFixed(1)}%`,
            txHash: agentResult.transaction_hash,
            agentStatus,
          })
        } else if (agentStatus === 'claim_triggered') {
          // ═══════════════════════════════════════════════════════════
          // Agent triggered claim but settlement failed or pending
          // Fall back to direct RLUSD Payment
          // ═══════════════════════════════════════════════════════════

          console.log('   ⚡ Agent triggered claim, executing RLUSD payout...')

          const farmerAddress = policy.user?.walletAddress
          if (!farmerAddress) {
            throw new Error('Farmer wallet address not found')
          }

          const payoutResult = await sendRlusdPayout(
            insurerWallet,
            farmerAddress,
            Number(policy.coverageAmount),
          )

          console.log(`   ✅ Payout successful: ${payoutResult.txHash}`)

          await prisma.policy.update({
            where: { id: policy.id },
            data: {
              status: PolicyStatus.CLAIMED,
              claimedAt: new Date(),
              claimTxHash: payoutResult.txHash,
            }
          })

          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.PAYOUT_SUCCESS,
              txHash: payoutResult.txHash,
              consensusScore: riskScore,
              weatherData: {
                agentName: 'Pavilion',
                agentStatus,
                reasoning_log: reasoningLog,
                source: 'agent_trigger_with_rlusd_fallback',
              },
            }
          })

          results.push({
            policyId: policy.id,
            triggered: true,
            severity: riskScore,
            reason: `Pavilion triggered, RLUSD payout executed — risk ${(riskScore * 100).toFixed(1)}%`,
            txHash: payoutResult.txHash,
            agentStatus,
          })
        } else {
          // ═══════════════════════════════════════════════════════════
          // Agent says safe — log monitoring check
          // ═══════════════════════════════════════════════════════════

          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.CHECK_TRIGGERED,
              consensusScore: riskScore,
              weatherData: {
                agentName: 'Pavilion',
                agentStatus,
                reasoning_log: reasoningLog,
                source: 'agent_monitoring_graph',
              },
            }
          })

          results.push({
            policyId: policy.id,
            triggered: false,
            severity: riskScore,
            reason: `Pavilion: safe — risk ${(riskScore * 100).toFixed(1)}%`,
            agentStatus,
          })
        }

      } catch (policyError) {
        console.error(`   ❌ Error processing policy ${policy.id}:`, policyError)


        await prisma.oracleLog.create({
          data: {
            policyId: policy.id,
            action: OracleAction.PAYOUT_FAILED,
            errorMessage: policyError instanceof Error ? policyError.message : 'Unknown error',
          }
        })

        results.push({
          policyId: policy.id,
          triggered: false,
          reason: `Error: ${policyError instanceof Error ? policyError.message : 'Unknown'}`,
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. Return Summary
    // ═══════════════════════════════════════════════════════════════════

    const triggered = results.filter(r => r.triggered).length

    console.log(`\n🔮 Pavilion Agent Cron Complete`)
    console.log(`   Processed: ${results.length}`)
    console.log(`   Triggered: ${triggered}`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: results.length,
      triggered,
      results,
    })

  } catch (error) {
    console.error('Oracle Cron Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
    }, { status: 500 })
  }
}

// Also support GET for easy browser testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Pavilion Agent Cron Endpoint',
    usage: 'POST with Authorization header to trigger agent monitoring cycle',
    note: 'In development, auth is optional for testing',
    backend: BACKEND_URL,
  })
}
