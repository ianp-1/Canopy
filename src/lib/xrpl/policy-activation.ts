/**
 * Policy Activation on XRPL
 * 
 * High-level orchestration for activating a policy on the blockchain:
 * 1. Record coverage commitment (RLUSD payouts are sent directly when triggered)
 * 2. NFTokenMint - Mint policy NFT with metadata
 * 3. NFTokenCreateOffer - Create sell offer to farmer (0 XRP)
 * 
 * Note: XRPL escrows only support native XRP. Since this application uses RLUSD
 * (an issued currency), coverage payouts are handled via direct RLUSD Payment
 * transactions when the oracle triggers a claim.
 * 
 * @module xrpl/policy-activation
 */

import { Client, Wallet, NFTokenMint, NFTokenCreateOffer } from 'xrpl';
import { generateCryptoCondition } from './escrow-create';
import { 
  encodeMetadataAsUri, 
  extractNFTokenIdFromMeta, 
  NFT_FLAGS,
  type PolicyNFTMetadata 
} from './nft-mint';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

/**
 * Result of policy activation on XRPL
 */
export interface PolicyActivationResult {
  // Coverage commitment data (tracked in DB; payout sent via RLUSD Payment when triggered)
  commitment: {
    condition: string;
    fulfillment: string;
    coverageAmount: number;
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
 * This function performs the blockchain activation:
 * 1. Generates crypto-condition for future payout verification
 * 2. Mints policy NFT with coverage metadata
 * 3. Creates sell offer to farmer
 * 
 * Note: Coverage is committed in the database. When the oracle triggers a claim,
 * a direct RLUSD Payment is sent from the insurer to the farmer.
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
    policyTitle,
    coordinates,
    thresholdRainfall,
  } = input;
  
  console.log('🔗 Starting XRPL Policy Activation...');
  console.log(`   Insurer: ${insurerWallet.address}`);
  console.log(`   Farmer: ${farmerAddress}`);
  console.log(`   Coverage: ${coverageAmountRlusd} RLUSD`);
  
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Generate Crypto-Condition for Coverage Commitment
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n📦 Phase 1: Recording Coverage Commitment...');
  
  // Generate crypto-condition pair for audit trail / future verification
  const { condition, fulfillment } = generateCryptoCondition();
  
  console.log(`   ✅ Coverage commitment recorded`);
  console.log(`   Amount: ${coverageAmountRlusd} RLUSD`);
  
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Mint Policy NFT
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n🎨 Phase 2: Minting Policy NFT...');
  
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    
    // Prepare NFT metadata with human-readable name
    const cropName = policyTitle.replace(' Drought Protection', '');
    const policyName = `${cropName} RLUSD Policy`;
    
    const metadata: PolicyNFTMetadata = {
      name: policyName,
      policy_type: policyTitle,
      coordinates: { lat: coordinates.lat, lng: coordinates.lng },
      threshold: `Rainfall < ${thresholdRainfall}mm`,
      payout_amount: String(coverageAmountRlusd),
      escrow_sequence: 0, // No escrow for RLUSD; payout via direct Payment
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
    const mintMeta = mintResult.result.meta;
    const mintSuccess = typeof mintMeta === 'object' && mintMeta !== null
      && 'TransactionResult' in mintMeta && mintMeta.TransactionResult === 'tesSUCCESS';
    const nftTokenId = extractNFTokenIdFromMeta(mintResult.result.meta);
    
    if (!mintSuccess || !nftTokenId) {
      throw new Error('NFT mint transaction failed or could not extract NFTokenID');
    }
    
    console.log(`   ✅ NFT Minted`);
    console.log(`   Token ID: ${nftTokenId}`);
    console.log(`   TX Hash: ${mintTxHash}`);
    
    // ═══════════════════════════════════════════════════════════════════
    // Create Sell Offer to Farmer (0 XRP - free transfer)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📤 Creating NFT Offer to Farmer...');
    
    const offerTx: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: insurerWallet.address,
      NFTokenID: nftTokenId,
      Amount: '0', // Free transfer
      Destination: farmerAddress,
      Flags: 1, // tfSellNFToken
    };
    
    const offerResult = await client.submitAndWait(offerTx, {
      wallet: insurerWallet,
    });
    
    const offerTxHash = offerResult.result.hash;
    const offerMetaRaw = offerResult.result.meta;
    const offerSuccess = typeof offerMetaRaw === 'object' && offerMetaRaw !== null
      && 'TransactionResult' in offerMetaRaw && offerMetaRaw.TransactionResult === 'tesSUCCESS';
    
    // Extract offer ID from metadata
    const offerMeta = offerMetaRaw as any;
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
      commitment: {
        condition,
        fulfillment,
        coverageAmount: coverageAmountRlusd,
      },
      nft: {
        tokenId: nftTokenId,
        mintTxHash,
        offerTxHash,
        offerId,
      },
      confirmed: mintSuccess && offerSuccess,
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
    nftMintTx: `${base}/transactions/${result.nft.mintTxHash}`,
    nftOfferTx: `${base}/transactions/${result.nft.offerTxHash}`,
    // Direct NFT link (may take time to index)
    nftToken: `${base}/nft/${result.nft.tokenId}`,
    // Account NFT lookup (more reliable immediately after minting)
    accountNfts: insurerAddress ? `${base}/accounts/${insurerAddress}/nfts` : undefined,
  };
}
