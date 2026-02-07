/**
 * Oracle Cron Job API
 * 
 * Monitors active policies and triggers payouts when weather conditions are met.
 * This is a temporary solution - for production, use Vercel Cron or similar.
 * 
 * @route POST /api/cron/oracle
 * 
 * Security: Protected by CRON_SECRET header
 * 
 * How it works:
 * 1. Fetch all ACTIVE policies with escrow data
 * 2. For each policy, check weather conditions (mock for now)
 * 3. If threshold met, trigger EscrowFinish
 * 4. Update policy status to CLAIMED
 * 5. Log results to OracleLog table
 */

import { NextRequest, NextResponse } from 'next/server'
import { Wallet } from 'xrpl'
import prisma from '@/lib/prisma'
import { finishEscrow } from '@/lib/xrpl'
import { PolicyStatus, OracleAction } from '@prisma/client'

// Environment
const CRON_SECRET = process.env.CRON_SECRET
const ORACLE_SEED = process.env.XRPL_ORACLE_SEED

/**
 * Mock weather data for testing
 * In production, replace with real weather API
 */
function getMockWeather(lat: number, lng: number) {
  // Simulate drought conditions (low rainfall)
  return {
    rainfall_mm: 2, // Below typical 10mm threshold = trigger
    temperature_c: 35,
    humidity_percent: 20,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. Security Check
    // ═══════════════════════════════════════════════════════════════════

    const authHeader = request.headers.get('authorization')

    // Allow bypass for testing or require secret
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      // Also allow manual testing without auth in development
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!ORACLE_SEED) {
      return NextResponse.json({
        error: 'Server configuration error: XRPL_ORACLE_SEED not set'
      }, { status: 500 })
    }

    const oracleWallet = Wallet.fromSeed(ORACLE_SEED)

    console.log('🔮 Oracle Cron Job Started')
    console.log(`   Oracle Wallet: ${oracleWallet.address}`)

    // ═══════════════════════════════════════════════════════════════════
    // 2. Fetch Active Policies with Escrow Data
    // ═══════════════════════════════════════════════════════════════════

    const policies = await prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        escrowSequence: { not: null },
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
      txHash?: string
    }> = []

    for (const policy of policies) {
      console.log(`\n📋 Processing Policy ${policy.id}`)

      try {
        // Get coordinates
        const coords = policy.coordinates as { lat: number; lng: number } | null
        const lat = coords?.lat || 0
        const lng = coords?.lng || 0

        // Get weather data (mock)
        const weather = getMockWeather(lat, lng)
        console.log(`   Weather: ${weather.rainfall_mm}mm rainfall`)

        // Check threshold
        const threshold = policy.thresholdRainfall || 10
        const shouldTrigger = weather.rainfall_mm < threshold

        console.log(`   Threshold: ${threshold}mm`)
        console.log(`   Trigger: ${shouldTrigger ? 'YES' : 'NO'}`)

        if (shouldTrigger) {
          // ═══════════════════════════════════════════════════════════════
          // 4. Trigger EscrowFinish
          // ═══════════════════════════════════════════════════════════════

          console.log('   ⚡ Triggering payout...')

          // Get insurer address from XRP escrow data
          const insurerAddress = process.env.INSURER_WALLET_ADDRESS

          if (!insurerAddress) {
            throw new Error('INSURER_WALLET_ADDRESS not configured')
          }

          const finishResult = await finishEscrow(
            oracleWallet,
            insurerAddress,
            policy.escrowSequence!,
            policy.escrowCondition!,
            policy.escrowFulfillment!
          )

          console.log(`   ✅ Payout successful: ${finishResult.txHash}`)

          // Update policy status
          await prisma.policy.update({
            where: { id: policy.id },
            data: {
              status: PolicyStatus.CLAIMED,
              claimedAt: new Date(),
              claimTxHash: finishResult.txHash,
            }
          })

          // Log oracle action
          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.PAYOUT_SUCCESS,
              txHash: finishResult.txHash,
              weatherData: weather,
              consensusScore: 1.0,
            }
          })

          results.push({
            policyId: policy.id,
            triggered: true,
            reason: `Rainfall ${weather.rainfall_mm}mm < ${threshold}mm threshold`,
            txHash: finishResult.txHash,
          })

        } else {
          // Log check without trigger
          await prisma.oracleLog.create({
            data: {
              policyId: policy.id,
              action: OracleAction.CHECK_TRIGGERED,
              weatherData: weather,
              consensusScore: 0,
            }
          })

          results.push({
            policyId: policy.id,
            triggered: false,
            reason: `Rainfall ${weather.rainfall_mm}mm >= ${threshold}mm threshold`,
          })
        }

      } catch (policyError) {
        console.error(`   ❌ Error processing policy ${policy.id}:`, policyError)

        // Log failed attempt
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
  })
}
