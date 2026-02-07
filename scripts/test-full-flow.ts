/**
 * End-to-End Full Flow Verification
 * 
 * Tests the complete policy lifecycle:
 * 1. Policy Activation (Escrow + NFT)
 * 2. Oracle Trigger (Weather Check + Payout)
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
  finishEscrow,
} from '../src/lib/xrpl';

// Color output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function main() {
  console.log(bold('\n═══════════════════════════════════════════════════════'));
  console.log(bold('  🌾 CANOPY - Full Policy Lifecycle Test'));
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
  const oracleWallet = Wallet.fromSeed(oracleSeed);

  console.log(cyan('📍 Wallets:'));
  console.log(`   Insurer: ${insurerWallet.address}`);
  console.log(`   Farmer:  ${farmerWallet.address}`);
  console.log(`   Oracle:  ${oracleWallet.address}`);

  // Check initial balances
  console.log(cyan('\n💰 Initial Balances:'));
  const insurerBefore = await getAccountBalance(insurerWallet.address);
  const farmerBefore = await getAccountBalance(farmerWallet.address);
  console.log(`   Insurer: ${dropsToXrp(insurerBefore)} XRP`);
  console.log(`   Farmer:  ${dropsToXrp(farmerBefore)} XRP`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1 + 2: Policy Activation
  // ═══════════════════════════════════════════════════════════════════
  
  console.log(yellow('\n════════════════════════════════════════'));
  console.log(yellow('  STEP 1: Policy Activation (Escrow + NFT)'));
  console.log(yellow('════════════════════════════════════════\n'));

  const coverageAmount = 100; // 100 XRP for testing (not 2000)
  const thresholdRainfall = 10;

  const activationResult = await activatePolicyOnXRPL({
    insurerWallet,
    farmerAddress: farmerWallet.address,
    coverageAmountXrp: coverageAmount,
    premiumAmountXrp: 5, // Mock premium
    policyTitle: 'Corn Drought Protection',
    coordinates: { lat: 36.7783, lng: -119.4179 },
    thresholdRainfall,
  });

  const urls = getExplorerUrls(activationResult);
  
  console.log(green('\n✅ Policy Activation Complete'));
  console.log(cyan('\n📦 Escrow Data:'));
  console.log(`   Sequence:  ${activationResult.escrow.sequence}`);
  console.log(`   TX Hash:   ${activationResult.escrow.txHash.slice(0, 16)}...`);
  console.log(`   Explorer:  ${urls.escrowTx}`);
  
  console.log(cyan('\n🎨 NFT Data:'));
  console.log(`   Token ID:  ${activationResult.nft.tokenId.slice(0, 16)}...`);
  console.log(`   Mint TX:   ${activationResult.nft.mintTxHash.slice(0, 16)}...`);
  console.log(`   Explorer:  ${urls.nftToken}`);

  // Check balance after escrow
  const insurerAfterEscrow = await getAccountBalance(insurerWallet.address);
  console.log(cyan('\n💰 After Escrow:'));
  console.log(`   Insurer: ${dropsToXrp(insurerAfterEscrow)} XRP (locked ${coverageAmount} XRP)`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Oracle Trigger
  // ═══════════════════════════════════════════════════════════════════
  
  console.log(yellow('\n════════════════════════════════════════'));
  console.log(yellow('  STEP 2: Oracle Trigger (Weather Check)'));
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
    console.log(cyan('\n⚡ Executing EscrowFinish...'));
    
    // Wait a moment for FinishAfter
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finishResult = await finishEscrow(
      oracleWallet,
      insurerWallet.address,
      activationResult.escrow.sequence,
      activationResult.escrow.condition,
      activationResult.escrow.fulfillment
    );
    
    console.log(green('\n✅ Payout Triggered!'));
    console.log(`   TX Hash: ${finishResult.txHash}`);
    console.log(`   Explorer: https://testnet.xrpl.org/transactions/${finishResult.txHash}`);
  }

  // Final balances
  console.log(yellow('\n════════════════════════════════════════'));
  console.log(yellow('  FINAL RESULTS'));
  console.log(yellow('════════════════════════════════════════\n'));

  const insurerAfter = await getAccountBalance(insurerWallet.address);
  const farmerAfter = await getAccountBalance(farmerWallet.address);
  
  const insurerDiff = Number(dropsToXrp(insurerBefore)) - Number(dropsToXrp(insurerAfter));
  const farmerDiff = Number(dropsToXrp(farmerAfter)) - Number(dropsToXrp(farmerBefore));
  
  console.log(cyan('💰 Final Balances:'));
  console.log(`   Insurer: ${dropsToXrp(insurerAfter)} XRP (${insurerDiff > 0 ? '-' : '+'}${Math.abs(insurerDiff).toFixed(2)} XRP)`);
  console.log(`   Farmer:  ${dropsToXrp(farmerAfter)} XRP (${farmerDiff > 0 ? '+' : ''}${farmerDiff.toFixed(2)} XRP)`);

  if (farmerDiff >= coverageAmount * 0.99) { // Allow for fees
    console.log(green(`\n🎉 SUCCESS: Farmer received ~${coverageAmount} XRP coverage payout!`));
  } else if (farmerDiff > 0) {
    console.log(yellow(`\n⚠️  PARTIAL: Farmer received ${farmerDiff.toFixed(2)} XRP (expected ${coverageAmount})`));
  } else {
    console.log(red('\n❌ FAILED: Farmer did not receive payout'));
  }

  console.log(bold('\n═══════════════════════════════════════════════════════\n'));
}

main().catch(err => {
  console.error(red('\n❌ Error:'), err);
  process.exit(1);
});
