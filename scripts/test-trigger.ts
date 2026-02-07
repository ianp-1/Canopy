#!/usr/bin/env npx tsx
/**
 * Phase 3: Oracle Trigger Test
 * 
 * Tests the oracle service by:
 * 1. Creating a new escrow (simulating policy creation)
 * 2. Running the oracle trigger logic
 * 3. Verifying the escrow was finished correctly
 */

import 'dotenv/config';
import { Wallet } from 'xrpl';
import { 
  getAllWallets, 
  xrpToDrops, 
  createConditionalEscrow,
  generateCryptoCondition,
  getAccountBalance,
  dropsToXrp,
} from '../src/lib/xrpl';
import { 
  OracleService, 
  MockPolicyService,
  PolicyForOracle,
} from '../src/lib/oracle';

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Phase 3: Oracle Trigger Verification                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // ═══════════════════════════════════════════════════════════════
    // Step 1: Load wallets
    // ═══════════════════════════════════════════════════════════════
    console.log('[1/5] Loading wallets...');
    
    const { insurer, farmer, oracle } = getAllWallets();
    
    console.log(`  Insurer: ${insurer.address}`);
    console.log(`  Farmer:  ${farmer.address}`);
    console.log(`  Oracle:  ${oracle.address}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 2: Create a test escrow (simulating policy creation)
    // ═══════════════════════════════════════════════════════════════
    console.log('[2/5] Creating test escrow (simulating policy creation)...');
    
    // Get initial balances
    const insurerBefore = await getAccountBalance(insurer.address);
    const farmerBefore = await getAccountBalance(farmer.address);
    
    console.log(`  Initial Insurer Balance: ${dropsToXrp(insurerBefore)} XRP`);
    console.log(`  Initial Farmer Balance:  ${dropsToXrp(farmerBefore)} XRP`);
    
    // Create escrow (10 XRP for quick testing)
    const escrowAmount = 10;
    const escrowResult = await createConditionalEscrow(
      insurer,
      farmer.address,
      escrowAmount  // Pass XRP amount as number, function converts to drops internally
    );
    
    if (!escrowResult.confirmed) {
      throw new Error(`Failed to create escrow: ${escrowResult.txHash}`);
    }
    
    console.log(`  ✓ Escrow created successfully`);
    console.log(`  Tx Hash:        ${escrowResult.txHash}`);
    console.log(`  Offer Sequence: ${escrowResult.offerSequence}`);
    console.log(`  Amount:         ${escrowAmount} XRP`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Set up Oracle Service with mock policy
    // ═══════════════════════════════════════════════════════════════
    console.log('[3/5] Configuring Oracle Service...');
    
    const policyService = new MockPolicyService();
    
    // Create mock policy linked to the escrow
    const testPolicy: PolicyForOracle = {
      id: 'test-policy-001',
      coverageAmount: escrowAmount,
      escrowSequence: escrowResult.offerSequence,
      thresholdRainfall: 10,  // 10mm threshold
      farmerWallet: farmer.address,
      coordinates: { lat: 36.7783, lng: -119.4179 },  // California Central Valley
      condition: escrowResult.condition,
      fulfillment: escrowResult.fulfillment,
      insurerAddress: insurer.address,
    };
    
    policyService.addPolicy(testPolicy);
    
    const oracleService = new OracleService({
      oracleWallet: oracle,
      insurerWallet: insurer,
      insurerAddress: insurer.address,
      policyService,
      verbose: true,
    });
    
    console.log(`  ✓ Oracle service configured`);
    console.log(`  Policy ID:      ${testPolicy.id}`);
    console.log(`  Threshold:      ${testPolicy.thresholdRainfall}mm`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Wait for ledger validation
    // ═══════════════════════════════════════════════════════════════
    console.log('[4/5] Waiting for ledger validation (5s)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('  ✓ Wait complete');
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 5: Run Oracle trigger
    // ═══════════════════════════════════════════════════════════════
    console.log('[5/5] Running Oracle trigger...');
    
    const results = await oracleService.processAllPolicies();
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                  Processing Results                      ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const result of results) {
      console.log('');
      console.log(`  Policy: ${result.policyId}`);
      console.log(`  Decision: ${result.decision.shouldTrigger ? 'TRIGGERED' : 'NOT TRIGGERED'}`);
      console.log(`  Reason: ${result.decision.reason}`);
      
      if (result.payout) {
        console.log(`  Payout Success: ${result.payout.success ? '✓' : '✗'}`);
        if (result.payout.txHash) {
          console.log(`  Tx Hash: ${result.payout.txHash}`);
        }
        if (result.payout.error) {
          console.log(`  Error: ${result.payout.error}`);
        }
      }
    }
    
    // Check final balances
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                  Balance Changes                         ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const insurerAfter = await getAccountBalance(insurer.address);
    const farmerAfter = await getAccountBalance(farmer.address);
    
    const insurerDelta = Number(insurerAfter) - Number(insurerBefore);
    const farmerDelta = Number(farmerAfter) - Number(farmerBefore);
    
    console.log('');
    console.log(`  Insurer:`);
    console.log(`    Before: ${dropsToXrp(insurerBefore)} XRP`);
    console.log(`    After:  ${dropsToXrp(insurerAfter)} XRP`);
    console.log(`    Delta:  ${dropsToXrp(insurerDelta.toString())} XRP`);
    console.log('');
    console.log(`  Farmer:`);
    console.log(`    Before: ${dropsToXrp(farmerBefore)} XRP`);
    console.log(`    After:  ${dropsToXrp(farmerAfter)} XRP`);
    console.log(`    Delta:  ${dropsToXrp(farmerDelta.toString())} XRP`);
    console.log('');

    // Verify payout
    const firstResult = results[0];
    const payoutSuccess = firstResult?.payout?.success ?? false;
    const farmerReceived = farmerDelta >= escrowAmount * 1000000 * 0.99; // Allow for rounding

    if (payoutSuccess && farmerReceived) {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              ✓ VERIFICATION PASSED                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log(`\nOracle successfully triggered payout of ${escrowAmount} XRP to Farmer.`);
      console.log(`Tx Hash: ${firstResult.payout?.txHash}\n`);
      process.exit(0);
    } else {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              ✗ VERIFICATION FAILED                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('\nPayout did not complete as expected.');
      if (firstResult?.payout?.error) {
        console.log(`Error: ${firstResult.payout.error}`);
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Error during test:');
    console.error(error);
    process.exit(1);
  }
}

main();
