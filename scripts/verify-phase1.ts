#!/usr/bin/env npx tsx
/**
 * Phase 1: Parametric Escrow Verification Script
 * 
 * This script demonstrates the full "Lock-and-Trigger" lifecycle:
 * 1. Loads Insurer, Farmer, Oracle wallets from .env
 * 2. Creates a conditional escrow (100 XRP from Insurer to Farmer)
 * 3. Waits for ledger validation
 * 4. Oracle triggers EscrowFinish with fulfillment
 * 5. Logs balance changes
 */

import 'dotenv/config';
import {
  getAllWallets,
  createConditionalEscrow,
  finishEscrow,
  getAccountBalance,
  dropsToXrp,
} from '../src/lib/xrpl';

const ESCROW_AMOUNT_XRP = 100;

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Phase 1: Parametric Escrow Verification                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // ═══════════════════════════════════════════════════════════════
    // Step 1: Load wallets from .env
    // ═══════════════════════════════════════════════════════════════
    console.log('[1/5] Loading wallets from .env...');
    
    const { insurer, farmer, oracle } = getAllWallets();
    
    console.log(`  Insurer: ${insurer.address}`);
    console.log(`  Farmer:  ${farmer.address}`);
    console.log(`  Oracle:  ${oracle.address}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 2: Get initial balances
    // ═══════════════════════════════════════════════════════════════
    console.log('[2/5] Fetching initial balances...');
    
    const insurerInitialBalance = await getAccountBalance(insurer.address);
    const farmerInitialBalance = await getAccountBalance(farmer.address);
    
    console.log(`  Insurer: ${dropsToXrp(insurerInitialBalance)} XRP`);
    console.log(`  Farmer:  ${dropsToXrp(farmerInitialBalance)} XRP`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Create conditional escrow
    // ═══════════════════════════════════════════════════════════════
    console.log(`[3/5] Creating conditional escrow (${ESCROW_AMOUNT_XRP} XRP)...`);
    
    const escrowResult = await createConditionalEscrow(
      insurer,
      farmer.address,
      ESCROW_AMOUNT_XRP,
      1 // 1 second delay for testing
    );
    
    console.log(`  ✓ Escrow created successfully`);
    console.log(`  Tx Hash:        ${escrowResult.txHash}`);
    console.log(`  Offer Sequence: ${escrowResult.offerSequence}`);
    console.log(`  Condition:      ${escrowResult.condition.slice(0, 16)}...`);
    console.log(`  Fulfillment:    ${escrowResult.fulfillment.slice(0, 16)}...`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Wait for ledger validation and finishAfter time
    // ═══════════════════════════════════════════════════════════════
    console.log('[4/5] Waiting for ledger validation (5s)...');
    await sleep(5000);
    console.log('  ✓ Wait complete');
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 5: Oracle triggers EscrowFinish
    // ═══════════════════════════════════════════════════════════════
    console.log('[5/5] Oracle triggering EscrowFinish...');
    
    const finishResult = await finishEscrow(
      oracle,
      insurer.address,
      escrowResult.offerSequence,
      escrowResult.condition,
      escrowResult.fulfillment
    );
    
    if (finishResult.success) {
      console.log(`  ✓ Escrow finished successfully`);
    } else {
      console.log(`  ✗ Escrow finish failed`);
    }
    console.log(`  Tx Hash: ${finishResult.txHash}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Final: Verify balance changes
    // ═══════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    Balance Changes                       ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const insurerFinalBalance = await getAccountBalance(insurer.address);
    const farmerFinalBalance = await getAccountBalance(farmer.address);
    
    const insurerDelta = Number(insurerFinalBalance) - Number(insurerInitialBalance);
    const farmerDelta = Number(farmerFinalBalance) - Number(farmerInitialBalance);
    
    console.log('');
    console.log('  Insurer:');
    console.log(`    Initial: ${dropsToXrp(insurerInitialBalance)} XRP`);
    console.log(`    Final:   ${dropsToXrp(insurerFinalBalance)} XRP`);
    console.log(`    Delta:   ${dropsToXrp(insurerDelta)} XRP`);
    console.log('');
    console.log('  Farmer:');
    console.log(`    Initial: ${dropsToXrp(farmerInitialBalance)} XRP`);
    console.log(`    Final:   ${dropsToXrp(farmerFinalBalance)} XRP`);
    console.log(`    Delta:   ${dropsToXrp(farmerDelta)} XRP`);
    console.log('');

    // Verify expected outcome
    const expectedFarmerDelta = ESCROW_AMOUNT_XRP * 1_000_000; // in drops
    
    if (farmerDelta >= expectedFarmerDelta) {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              ✓ VERIFICATION PASSED                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log(`\nFarmer received ${dropsToXrp(farmerDelta)} XRP as expected.\n`);
      process.exit(0);
    } else {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              ✗ VERIFICATION FAILED                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log(`\nExpected farmer to receive ${ESCROW_AMOUNT_XRP} XRP, but delta was ${dropsToXrp(farmerDelta)} XRP.\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Error during verification:');
    console.error(error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
