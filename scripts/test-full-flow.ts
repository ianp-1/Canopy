/**
 * End-to-End Full Flow Verification
 * 
 * Tests the complete policy lifecycle with RLUSD:
 * 1. Policy Activation (NFT Mint)
 * 2. Pavilion Oracle Trigger (Weather Check + RLUSD Payout)
 * 
 * Usage: npx tsx scripts/test-full-flow.ts
 */

import 'dotenv/config';
import { Wallet } from 'xrpl';
import { 
  activatePolicyOnXRPL, 
  getExplorerUrls,
  getAccountBalance,
  dropsToXrp,
  sendRlusdPayout,
  getRlusdBalance,
} from '../src/lib/xrpl';

// Color output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function main() {
  console.log(bold('\n═══════════════════════════════════════════════════════'));
  console.log(bold('  🌾 CANOPY - Full Policy Lifecycle Test (RLUSD)'));
  console.log(bold('═══════════════════════════════════════════════════════\n'));

  // Load wallets
  const insurerSeed = process.env.XRPL_INSURER_SEED;
  const farmerSeed = process.env.XRPL_FARMER_SEED;
  const oracleSeed = process.env.XRPL_ORACLE_SEED;

  if (!insurerSeed || !farmerSeed || !oracleSeed) {
    console.error(red('❌ Missing wallet seeds in .env'));
    process.exit(1);
  }

  const insurerWallet = Wallet.fromSeed(insurerSeed);
  const farmerWallet = Wallet.fromSeed(farmerSeed);

  console.log(cyan('📍 Wallets:'));
  console.log(`   Insurer: ${insurerWallet.address}`);
  console.log(`   Farmer:  ${farmerWallet.address}`);

  // Check initial RLUSD balances
  console.log(cyan('\n💰 Initial RLUSD Balances:'));
  const insurerRlusdBefore = await getRlusdBalance(insurerWallet.address);
  const farmerRlusdBefore = await getRlusdBalance(farmerWallet.address);
  console.log(`   Insurer: ${insurerRlusdBefore} RLUSD`);
  console.log(`   Farmer:  ${farmerRlusdBefore} RLUSD`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1 + 2: Policy Activation
  // ═══════════════════════════════════════════════════════════════════
  
  console.log(yellow('\n════════════════════════════════════════'));
  console.log(yellow('  STEP 1: Policy Activation (NFT Mint)'));
  console.log(yellow('════════════════════════════════════════\n'));

  const coverageAmount = 100; // 100 RLUSD for testing
  const thresholdRainfall = 10;

  const activationResult = await activatePolicyOnXRPL({
    insurerWallet,
    farmerAddress: farmerWallet.address,
    coverageAmountRlusd: coverageAmount,
    premiumAmountRlusd: 5, // Mock premium
    policyTitle: 'Corn Drought Protection',
    coordinates: { lat: 36.7783, lng: -119.4179 },
    thresholdRainfall,
  });

  const urls = getExplorerUrls(activationResult);
  
  console.log(green('\n✅ Policy Activation Complete'));
  console.log(cyan('\n📦 Coverage Commitment:'));
  console.log(`   Amount:    ${activationResult.commitment.coverageAmount} RLUSD`);
  
  console.log(cyan('\n🎨 NFT Data:'));
  console.log(`   Token ID:  ${activationResult.nft.tokenId.slice(0, 16)}...`);
  console.log(`   Mint TX:   ${activationResult.nft.mintTxHash.slice(0, 16)}...`);
  console.log(`   Explorer:  ${urls.nftToken}`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Pavilion Oracle Trigger
  // ═══════════════════════════════════════════════════════════════════
  
  console.log(yellow('\n════════════════════════════════════════'));
  console.log(yellow('  STEP 2: Pavilion Oracle Trigger (Weather Check)'));
  console.log(yellow('════════════════════════════════════════\n'));

  // Simulate weather check
  const mockWeather = {
    rainfall_mm: 2,
    threshold_mm: thresholdRainfall,
  };
  
  console.log(cyan('🌧️ Weather Data:'));
  console.log(`   Rainfall:   ${mockWeather.rainfall_mm}mm`);
  console.log(`   Threshold:  ${mockWeather.threshold_mm}mm`);
  
  const shouldTrigger = mockWeather.rainfall_mm < mockWeather.threshold_mm;
  console.log(`   Trigger:    ${shouldTrigger ? green('YES ✓') : red('NO ✗')}`);

  if (shouldTrigger) {
    console.log(cyan('\n⚡ Executing RLUSD Payout...'));
    
    const payoutResult = await sendRlusdPayout(
      insurerWallet,
      farmerWallet.address,
      coverageAmount,
    );
    
    console.log(green('\n✅ Payout Triggered!'));
    console.log(`   TX Hash: ${payoutResult.txHash}`);
    console.log(`   Explorer: https://testnet.xrpl.org/transactions/${payoutResult.txHash}`);
  }

  // Final balances
  console.log(yellow('\n════════════════════════════════════════'));
  console.log(yellow('  FINAL RESULTS'));
  console.log(yellow('════════════════════════════════════════\n'));

  const insurerRlusdAfter = await getRlusdBalance(insurerWallet.address);
  const farmerRlusdAfter = await getRlusdBalance(farmerWallet.address);
  
  const insurerDiff = Number(insurerRlusdBefore) - Number(insurerRlusdAfter);
  const farmerDiff = Number(farmerRlusdAfter) - Number(farmerRlusdBefore);
  
  console.log(cyan('💰 Final RLUSD Balances:'));
  console.log(`   Insurer: ${insurerRlusdAfter} RLUSD (${insurerDiff > 0 ? '-' : '+'}${Math.abs(insurerDiff).toFixed(2)} RLUSD)`);
  console.log(`   Farmer:  ${farmerRlusdAfter} RLUSD (${farmerDiff > 0 ? '+' : ''}${farmerDiff.toFixed(2)} RLUSD)`);

  if (farmerDiff >= coverageAmount * 0.99) { // Allow for fees
    console.log(green(`\n🎉 SUCCESS: Farmer received ~${coverageAmount} RLUSD coverage payout!`));
  } else if (farmerDiff > 0) {
    console.log(yellow(`\n⚠️  PARTIAL: Farmer received ${farmerDiff.toFixed(2)} RLUSD (expected ${coverageAmount})`));
  } else {
    console.log(red('\n❌ FAILED: Farmer did not receive payout'));
  }

  console.log(bold('\n═══════════════════════════════════════════════════════\n'));
}

main().catch(err => {
  console.error(red('\n❌ Error:'), err);
  process.exit(1);
});
