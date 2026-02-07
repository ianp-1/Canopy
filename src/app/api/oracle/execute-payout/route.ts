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
import { sendRlusdPayout } from '@/lib/xrpl';
import { PolicyStatus, OracleAction } from '@/generated/prisma';

const ORACLE_SEED = process.env.XRPL_ORACLE_SEED;
const INSURER_ADDRESS = process.env.INSURER_WALLET_ADDRESS;
const INSURER_SEED = process.env.XRPL_INSURER_SEED;

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

    if (!policy.escrowCondition || !policy.escrowFulfillment) {
      return NextResponse.json(
        { error: 'Policy missing commitment data' },
        { status: 400 }
      );
    }

    if (!INSURER_SEED) {
      return NextResponse.json(
        { error: 'Server configuration error: XRPL_INSURER_SEED not set' },
        { status: 500 }
      );
    }

    // Execute RLUSD payout via direct Payment
    const insurerWallet = Wallet.fromSeed(INSURER_SEED);
    const farmerAddress = policy.user?.walletAddress;

    if (!farmerAddress) {
      return NextResponse.json(
        { error: 'Farmer wallet address not found' },
        { status: 400 }
      );
    }

    console.log(`[Execute Payout] Triggering RLUSD payout for policy ${policyId}`);
    console.log(`  Insurer: ${insurerWallet.address}`);
    console.log(`  Farmer: ${farmerAddress}`);
    console.log(`  Amount: ${Number(policy.coverageAmount)} RLUSD`);
    console.log(`  Confirmed Severity: ${(confirmedSeverity * 100).toFixed(1)}%`);

    const payoutResult = await sendRlusdPayout(
      insurerWallet,
      farmerAddress,
      Number(policy.coverageAmount),
    );

    console.log(`  ✅ Payout successful: ${payoutResult.txHash}`);

    // Update policy status
    await prisma.policy.update({
      where: { id: policyId },
      data: {
        status: PolicyStatus.CLAIMED,
        claimedAt: new Date(),
        claimTxHash: payoutResult.txHash,
      },
    });

    // Log oracle action
    await prisma.oracleLog.create({
      data: {
        policyId: policyId,
        action: OracleAction.PAYOUT_SUCCESS,
        txHash: payoutResult.txHash,
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
      txHash: payoutResult.txHash,
      newStatus: PolicyStatus.CLAIMED,
      message: `Payout executed successfully. ${Number(policy.coverageAmount)} RLUSD released to farmer.`,
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
