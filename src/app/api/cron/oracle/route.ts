/**
 * Oracle Cron Job API
 * 
 * Monitors active policies and triggers payouts when drought conditions are met.
 * Now integrated with the Python backend for real ML-based risk evaluation.
 * 
 * @route POST /api/cron/oracle
 * 
 * Security: Protected by CRON_SECRET header
 * 
 * How it works:
 * 1. Fetch all ACTIVE policies with escrow data
 * 2. For each policy, call Python backend to evaluate risk
 * 3. If severity threshold met, trigger EscrowFinish
 * 4. Update policy status to CLAIMED
 * 5. Log results to OracleLog table
 */

import { NextRequest, NextResponse } from 'next/server'
import { Wallet } from 'xrpl'
import prisma from '@/lib/prisma'
import { sendRlusdPayout } from '@/lib/xrpl'
import { evaluateRiskViaBackend } from '@/lib/oracle'
import { PolicyStatus, OracleAction } from '@/generated/prisma'

// Environment
const CRON_SECRET = process.env.CRON_SECRET
const INSURER_SEED = process.env.XRPL_INSURER_SEED

// Severity threshold for triggering payout (0-1 scale)
// 0.85 = 85% severity means "trigger payout"
const SEVERITY_THRESHOLD = 0.85

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

    console.log('🔮 Oracle Cron Job Started')
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
    // 2. Fetch Active Policies with Escrow Data
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
    // 3. Process Each Policy
    // ═══════════════════════════════════════════════════════════════════

    const results: Array<{
      policyId: string
      triggered: boolean
      reason: string
      severity?: number
      txHash?: string
    }> = []

    for (const policy of policies) {
      console.log(`\n📋 Processing Policy ${policy.id}`)

      try {
        // Get geometry from the policy directly (stored when policy was created)
        const geometry = policy.geometry as object | null
        const coords = policy.coordinates as { lat: number; lng: number } | null
        const lat = coords?.lat || 0
        const lng = coords?.lng || 0

        // Build geometry from coordinates if no field geometry exists
        const evaluationGeometry = geometry || (coords ? {
          type: 'Polygon',
          coordinates: [[
            [lng - 0.01, lat - 0.01],
            [lng + 0.01, lat - 0.01],
            [lng + 0.01, lat + 0.01],
            [lng - 0.01, lat + 0.01],
            [lng - 0.01, lat - 0.01],
          ]]
        } : null)

        if (!evaluationGeometry) {
          console.log(`   ⚠️ No geometry or coordinates found, skipping`)
          results.push({
            policyId: policy.id,
            triggered: false,
            reason: 'No geometry or coordinates available for evaluation',
          })
          continue
        }

        // ═══════════════════════════════════════════════════════════════
        // 3a. Call Python Backend for Risk Evaluation
        // ═══════════════════════════════════════════════════════════════

        console.log(`   🧠 Evaluating risk via backend...`)

        const evaluation = await evaluateRiskViaBackend(
          evaluationGeometry,
          'generic', // TODO: Add cropType to Policy model if needed
          new Date().toISOString().split('T')[0] // Today's date
        )

        if (!evaluation.success) {
          console.log(`   ⚠️ Backend evaluation failed: ${evaluation.error}`)
          results.push({
            policyId: policy.id,
            triggered: false,
            reason: `Backend error: ${evaluation.error}`,
          })
          continue
        }

        const severity = evaluation.severity
        const shouldTrigger = severity >= SEVERITY_THRESHOLD

        console.log(`   Severity: ${(severity * 100).toFixed(1)}%`)
        console.log(`   Threshold: ${(SEVERITY_THRESHOLD * 100).toFixed(1)}%`)
        console.log(`   Trigger: ${shouldTrigger ? 'YES' : 'NO'}`)

        if (shouldTrigger) {
          // ═══════════════════════════════════════════════════════════════
          // 4. Trigger EscrowFinish
          // ═══════════════════════════════════════════════════════════════

          console.log('   ⚡ Triggering RLUSD payout...')

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

          // Update policy status
          await prisma.policy.update({
            where: { id: policy.id },
            data: {
              status: PolicyStatus.CLAIMED,
              claimedAt: new Date(),
              claimTxHash: payoutResult.txHash,
            }
          })

          // Log oracle action
          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.PAYOUT_SUCCESS,
              txHash: payoutResult.txHash,
              weatherData: { severity, source: 'backend' },
              consensusScore: severity,
            }
          })

          results.push({
            policyId: policy.id,
            triggered: true,
            severity,
            reason: `Severity ${(severity * 100).toFixed(1)}% >= ${(SEVERITY_THRESHOLD * 100).toFixed(1)}% threshold`,
            txHash: payoutResult.txHash,
          })

        } else {
          // Log check without trigger
          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.CHECK_TRIGGERED,
              weatherData: { severity, source: 'backend' },
              consensusScore: severity,
            }
          })

          results.push({
            policyId: policy.id,
            triggered: false,
            severity,
            reason: `Severity ${(severity * 100).toFixed(1)}% < ${(SEVERITY_THRESHOLD * 100).toFixed(1)}% threshold`,
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

    console.log(`\n🔮 Oracle Cron Complete`)
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
    message: 'Oracle Cron Endpoint',
    usage: 'POST with Authorization header to trigger oracle check',
    note: 'In development, auth is optional for testing',
    backend: process.env.BACKEND_URL || 'http://localhost:8000',
  })
}
