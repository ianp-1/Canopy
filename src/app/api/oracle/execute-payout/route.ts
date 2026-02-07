/**
 * Execute Payout API
 * 
 * Manually executes a payout for a policy that has been evaluated and confirmed.
 * Triggers EscrowFinish and updates policy status to CLAIMED.
 * 
 * @route POST /api/oracle/execute-payout
 */

import { NextRequest, NextResponse } from 'next/server';
import { Wallet } from 'xrpl';
import prisma from '@/lib/prisma';
import { finishEscrow } from '@/lib/xrpl';
import { PolicyStatus, OracleAction } from '@/generated/prisma';

const ORACLE_SEED = process.env.XRPL_ORACLE_SEED;
const INSURER_ADDRESS = process.env.INSURER_WALLET_ADDRESS;

interface ExecutePayoutRequest {
  policyId: string;
  confirmedSeverity: number; // The severity from simulation, for audit trail
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecutePayoutRequest = await request.json();
    const { policyId, confirmedSeverity } = body;

    if (!policyId) {
      return NextResponse.json(
        { error: 'policyId is required' },
        { status: 400 }
      );
    }

    if (!ORACLE_SEED) {
      return NextResponse.json(
        { error: 'Server configuration error: XRPL_ORACLE_SEED not set' },
        { status: 500 }
      );
    }

    if (!INSURER_ADDRESS) {
      return NextResponse.json(
        { error: 'Server configuration error: INSURER_WALLET_ADDRESS not set' },
        { status: 500 }
      );
    }

    // Fetch policy with escrow data
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { user: true },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Validate policy state
    if (policy.status !== PolicyStatus.ACTIVE) {
      return NextResponse.json(
        { error: `Policy is not active. Current status: ${policy.status}` },
        { status: 400 }
      );
    }

    if (!policy.escrowSequence || !policy.escrowCondition || !policy.escrowFulfillment) {
      return NextResponse.json(
        { error: 'Policy missing escrow data' },
        { status: 400 }
      );
    }

    // Execute EscrowFinish
    const oracleWallet = Wallet.fromSeed(ORACLE_SEED);

    console.log(`[Execute Payout] Triggering payout for policy ${policyId}`);
    console.log(`  Oracle: ${oracleWallet.address}`);
    console.log(`  Escrow Sequence: ${policy.escrowSequence}`);
    console.log(`  Confirmed Severity: ${(confirmedSeverity * 100).toFixed(1)}%`);

    const finishResult = await finishEscrow(
      oracleWallet,
      INSURER_ADDRESS,
      policy.escrowSequence,
      policy.escrowCondition,
      policy.escrowFulfillment
    );

    console.log(`  ✅ Payout successful: ${finishResult.txHash}`);

    // Update policy status
    await prisma.policy.update({
      where: { id: policyId },
      data: {
        status: PolicyStatus.CLAIMED,
        claimedAt: new Date(),
        claimTxHash: finishResult.txHash,
      },
    });

    // Log oracle action
    await prisma.oracleLog.create({
      data: {
        policyId: policyId,
        action: OracleAction.PAYOUT_SUCCESS,
        txHash: finishResult.txHash,
        weatherData: { 
          severity: confirmedSeverity, 
          source: 'manual_execution',
          executedAt: new Date().toISOString(),
        },
        consensusScore: confirmedSeverity,
      },
    });

    return NextResponse.json({
      success: true,
      policyId,
      txHash: finishResult.txHash,
      newStatus: PolicyStatus.CLAIMED,
      message: `Payout executed successfully. ${Number(policy.coverageAmount)} XRP released to farmer.`,
    });

  } catch (error) {
    console.error('Execute payout error:', error);

    // Try to log the failure
    try {
      const body = await request.clone().json();
      if (body.policyId) {
        await prisma.oracleLog.create({
          data: {
            policyId: body.policyId,
            action: OracleAction.PAYOUT_FAILED,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
