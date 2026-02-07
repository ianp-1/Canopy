/**
 * Policy Activation on XRPL
 * 
 * High-level orchestration for activating a policy on the blockchain:
 * 1. EscrowCreate - Lock coverage funds with crypto-condition (RLUSD)
 * 2. NFTokenMint - Mint policy NFT with metadata
 * 3. NFTokenCreateOffer - Create sell offer to farmer (0 RLUSD)
 * 
 * @module xrpl/policy-activation
 */

import { Client, Wallet, NFTokenMint, NFTokenCreateOffer } from 'xrpl';
import { createConditionalEscrow, type EscrowCreateResult } from './escrow-create';
import { 
  encodeMetadataAsUri, 
  extractNFTokenIdFromMeta, 
  NFT_FLAGS,
  type PolicyNFTMetadata 
} from './nft-mint';
import { rlusdToAmount } from './wallet-utils';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

/**
 * Result of policy activation on XRPL
 */
export interface PolicyActivationResult {
  // Escrow data
  escrow: {
    txHash: string;
    sequence: number;
    condition: string;
    fulfillment: string;
  };
  
  // NFT data
  nft: {
    tokenId: string;
    mintTxHash: string;
    offerTxHash: string;
    offerId: string;
  };
  
  // Summary
  confirmed: boolean;
}

/**
 * Input for policy activation
 */
export interface PolicyActivationInput {
  insurerWallet: Wallet;
  farmerAddress: string;
  coverageAmountRlusd: number;
  premiumAmountRlusd: number;
  policyTitle: string;
  coordinates: { lat: number; lng: number };
  thresholdRainfall: number;
}

/**
 * Activate a policy on XRPL
 * 
 * This function performs the complete blockchain activation:
 * 1. Creates conditional escrow (Phase 1)
 * 2. Mints policy NFT (Phase 2)
 * 3. Creates sell offer to farmer
 * 
 * @param input - Policy activation parameters
 * @returns Activation result with all XRPL data
 */
export async function activatePolicyOnXRPL(
  input: PolicyActivationInput
): Promise<PolicyActivationResult> {
  const { 
    insurerWallet, 
    farmerAddress, 
    coverageAmountRlusd, 
    premiumAmountRlusd,
    policyTitle,
    coordinates,
    thresholdRainfall,
  } = input;
  
  console.log('🔗 Starting XRPL Policy Activation...');
  console.log(`   Insurer: ${insurerWallet.address}`);
  console.log(`   Farmer: ${farmerAddress}`);
  console.log(`   Coverage: ${coverageAmountRlusd} RLUSD`);
  
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Create Conditional Escrow
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📦 Phase 1: Creating Conditional Escrow...');
  
  const escrowResult = await createConditionalEscrow(
    insurerWallet,
    farmerAddress,
    coverageAmountRlusd,
    1 // 1 second delay for testing (can be longer in production)
  );
  
  console.log(`   ✅ Escrow Created`);
  console.log(`   TX Hash: ${escrowResult.txHash}`);
  console.log(`   Sequence: ${escrowResult.offerSequence}`);
  
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Mint Policy NFT
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🎨 Phase 2: Minting Policy NFT...');
  
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    
    // Prepare NFT metadata with human-readable name
    const cropName = policyTitle.replace(' Drought Protection', '');
    const policyName = `${cropName} Policy #${escrowResult.offerSequence}`;
    
    // Convert RLUSD amount to string for NFT metadata
    const payoutAmount = rlusdToAmount(coverageAmountRlusd);
    
    const metadata: PolicyNFTMetadata = {
      name: policyName,
      policy_type: policyTitle,
      coordinates: { lat: coordinates.lat, lng: coordinates.lng },
      threshold: `Rainfall < ${thresholdRainfall}mm`,
      payout_amount: JSON.stringify(payoutAmount), // Store full RLUSD amount object
      escrow_sequence: escrowResult.offerSequence,
      issue_date: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    };
    
    const uriHex = encodeMetadataAsUri(metadata);
    
    // Mint NFT transaction
    const mintTx: NFTokenMint = {
      TransactionType: 'NFTokenMint',
      Account: insurerWallet.address,
      URI: uriHex,
      Flags: NFT_FLAGS.tfTransferable,
      NFTokenTaxon: 1, // Policy NFT category
      TransferFee: 0,  // No royalties
    };
    
    const mintResult = await client.submitAndWait(mintTx, {
      wallet: insurerWallet,
    });
    
    const mintTxHash = mintResult.result.hash;
    const nftTokenId = extractNFTokenIdFromMeta(mintResult.result.meta);
    
    if (!nftTokenId) {
      throw new Error('Failed to extract NFTokenID from mint transaction');
    }
    
    console.log(`   ✅ NFT Minted`);
    console.log(`   Token ID: ${nftTokenId}`);
    console.log(`   TX Hash: ${mintTxHash}`);
    
    // ═══════════════════════════════════════════════════════════════════
    // Create Sell Offer to Farmer (0 - free transfer)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📤 Creating NFT Offer to Farmer...');
    
    const offerTx: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: insurerWallet.address,
      NFTokenID: nftTokenId,
      Amount: '0', // Free transfer (XRP drops for NFT offers)
      Destination: farmerAddress,
      Flags: 1, // tfSellNFToken
    };
    
    const offerResult = await client.submitAndWait(offerTx, {
      wallet: insurerWallet,
    });
    
    const offerTxHash = offerResult.result.hash;
    
    // Extract offer ID from metadata
    const offerMeta = offerResult.result.meta as any;
    let offerId = '';
    if (offerMeta?.AffectedNodes) {
      for (const node of offerMeta.AffectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          offerId = node.CreatedNode.LedgerIndex;
          break;
        }
      }
    }
    
    console.log(`   ✅ Offer Created`);
    console.log(`   Offer ID: ${offerId}`);
    console.log(`   TX Hash: ${offerTxHash}`);
    
    console.log('\n🎉 Policy Activation Complete!');
    
    return {
      escrow: {
        txHash: escrowResult.txHash,
        sequence: escrowResult.offerSequence,
        condition: escrowResult.condition,
        fulfillment: escrowResult.fulfillment,
      },
      nft: {
        tokenId: nftTokenId,
        mintTxHash,
        offerTxHash,
        offerId,
      },
      confirmed: escrowResult.confirmed,
    };
    
  } finally {
    await client.disconnect();
  }
}

/**
 * Get XRPL Testnet Explorer URLs for transactions
 * @param result - The policy activation result
 * @param insurerAddress - The insurer's wallet address (optional, for account NFT lookup)
 */
export function getExplorerUrls(result: PolicyActivationResult, insurerAddress?: string) {
  const base = 'https://testnet.xrpl.org';
  
  return {
    escrowTx: `${base}/transactions/${result.escrow.txHash}`,
    nftMintTx: `${base}/transactions/${result.nft.mintTxHash}`,
    nftOfferTx: `${base}/transactions/${result.nft.offerTxHash}`,
    // Direct NFT link (may take time to index)
    nftToken: `${base}/nft/${result.nft.tokenId}`,
    // Account NFT lookup (more reliable immediately after minting)
    accountNfts: insurerAddress ? `${base}/accounts/${insurerAddress}/nfts` : undefined,
  };
}
