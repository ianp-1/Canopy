#!/usr/bin/env npx tsx
/**
 * Phase 2: Policy NFT Tokenization Verification Script
 * 
 * This script demonstrates the Policy NFT lifecycle:
 * 1. Creates policy metadata linked to a mock escrow
 * 2. Mints NFT from Insurer wallet
 * 3. Transfers NFT to Farmer
 * 4. Verifies NFT in Farmer's collection
 * 5. Decodes and displays metadata
 */

import 'dotenv/config';
import { Client, Wallet, NFTokenMint, NFTokenCreateOffer, NFTokenAcceptOffer } from 'xrpl';
import {
  getAllWallets,
  xrpToDrops,
  PolicyNFTMetadata,
  encodeMetadataAsUri,
  decodeUriToMetadata,
  extractNFTokenIdFromMeta,
  NFT_FLAGS,
} from '../src/lib/xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

// Mock escrow sequence from Phase 1 (use actual value in production)
const MOCK_ESCROW_SEQUENCE = 14630109;

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Phase 2: Policy NFT Tokenization Verification          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new Client(TESTNET_URL);

  try {
    await client.connect();

    // ═══════════════════════════════════════════════════════════════
    // Step 1: Load wallets and create policy metadata
    // ═══════════════════════════════════════════════════════════════
    console.log('[1/5] Creating policy metadata...');

    const { insurer, farmer } = getAllWallets();

    const policyMetadata: PolicyNFTMetadata = {
      policy_type: 'Drought Protection',
      name: 'Drought Protection Policy',
      coordinates: { lat: 36.7783, lng: -119.4179 },  // California Central Valley
      threshold: 'Rainfall < 10mm',
      payout_amount: xrpToDrops(100),  // 100 XRP
      escrow_sequence: MOCK_ESCROW_SEQUENCE,
      issue_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    console.log(`  Policy Type:    ${policyMetadata.policy_type}`);
    console.log(`  Coordinates:    (${policyMetadata.coordinates.lat}, ${policyMetadata.coordinates.lng})`);
    console.log(`  Threshold:      ${policyMetadata.threshold}`);
    console.log(`  Payout:         ${policyMetadata.payout_amount} drops`);
    console.log(`  Escrow Seq:     ${policyMetadata.escrow_sequence}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 2: Encode metadata and mint NFT
    // ═══════════════════════════════════════════════════════════════
    console.log('[2/5] Minting Policy NFT from Insurer...');

    const uriHex = encodeMetadataAsUri(policyMetadata);
    console.log(`  URI Hex Length: ${uriHex.length / 2} bytes`);

    const mintTx: NFTokenMint = {
      TransactionType: 'NFTokenMint',
      Account: insurer.address,
      URI: uriHex,
      NFTokenTaxon: 1,  // Policy category
      Flags: NFT_FLAGS.tfTransferable,
      TransferFee: 0,
    };

    const mintResult = await client.submitAndWait(mintTx, { wallet: insurer });
    const mintMeta = mintResult.result.meta;
    const nftTokenId = extractNFTokenIdFromMeta(mintMeta);

    if (!nftTokenId) {
      throw new Error('Failed to extract NFTokenID from mint result');
    }

    console.log(`  ✓ NFT minted successfully`);
    console.log(`  NFTokenID:  ${nftTokenId}`);
    console.log(`  Tx Hash:    ${mintResult.result.hash}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 3: Create sell offer for Farmer (0 XRP = gift)
    // ═══════════════════════════════════════════════════════════════
    console.log('[3/5] Creating transfer offer to Farmer...');

    const offerTx: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: insurer.address,
      NFTokenID: nftTokenId,
      Amount: '0',  // Free transfer (policy issuance)
      Destination: farmer.address,
      Flags: 1,  // tfSellNFToken
    };

    const offerResult = await client.submitAndWait(offerTx, { wallet: insurer });

    // Extract offer ID from metadata
    const offerMeta = offerResult.result.meta;
    let offerId = '';
    if (typeof offerMeta === 'object' && offerMeta !== null) {
      const affectedNodes = (offerMeta as any).AffectedNodes || [];
      for (const node of affectedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
          offerId = node.CreatedNode.LedgerIndex;
          break;
        }
      }
    }

    if (!offerId) {
      throw new Error('Failed to extract offer ID');
    }

    console.log(`  ✓ Sell offer created`);
    console.log(`  Offer ID:   ${offerId}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 4: Farmer accepts the offer
    // ═══════════════════════════════════════════════════════════════
    console.log('[4/5] Farmer accepting NFT offer...');

    const acceptTx: NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: farmer.address,
      NFTokenSellOffer: offerId,
    };

    const acceptResult = await client.submitAndWait(acceptTx, { wallet: farmer });

    console.log(`  ✓ NFT transferred to Farmer`);
    console.log(`  Tx Hash:    ${acceptResult.result.hash}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════
    // Step 5: Verify NFT in Farmer's collection
    // ═══════════════════════════════════════════════════════════════
    console.log('[5/5] Verifying Farmer\'s NFT collection...');

    const nftsResponse = await client.request({
      command: 'account_nfts',
      account: farmer.address,
    });

    const farmerNfts = nftsResponse.result.account_nfts;
    const foundNft = farmerNfts.find((nft: any) => nft.NFTokenID === nftTokenId);

    if (!foundNft) {
      throw new Error('NFT not found in Farmer\'s account');
    }

    console.log(`  ✓ NFT found in Farmer's collection`);
    console.log(`  Total NFTs: ${farmerNfts.length}`);
    console.log('');

    // Decode and display metadata
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                  Decoded NFT Metadata                    ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!foundNft.URI) {
      throw new Error('NFT has no URI field');
    }

    const decodedMetadata = decodeUriToMetadata(foundNft.URI);
    console.log('');
    console.log(`  Policy Type:    ${decodedMetadata.policy_type}`);
    console.log(`  Coordinates:    (${decodedMetadata.coordinates?.lat}, ${decodedMetadata.coordinates?.lng})`);
    console.log(`  Threshold:      ${decodedMetadata.threshold}`);
    console.log(`  Payout:         ${decodedMetadata.payout_amount} drops`);
    console.log(`  Escrow Seq:     ${decodedMetadata.escrow_sequence}`);
    console.log('');

    // Verify escrow sequence matches
    if (decodedMetadata.escrow_sequence === MOCK_ESCROW_SEQUENCE) {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              ✓ VERIFICATION PASSED                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log(`\nPolicy NFT successfully minted and transferred to Farmer.`);
      console.log(`NFTokenID: ${nftTokenId}\n`);
      process.exit(0);
    } else {
      throw new Error('Metadata escrow_sequence mismatch');
    }

  } catch (error) {
    console.error('\n✗ Error during verification:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main();
