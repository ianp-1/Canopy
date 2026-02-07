import { Wallet } from 'xrpl';
import 'dotenv/config';
import {
  PolicyNFTMetadata,
  CompactPolicyMetadata,
  NFTMintResult,
  NFTTransferResult,
  toCompactMetadata,
  fromCompactMetadata,
} from './nft-types';

// Re-export types
export type { PolicyNFTMetadata, CompactPolicyMetadata, NFTMintResult, NFTTransferResult };
export { toCompactMetadata, fromCompactMetadata };

/**
 * Convert a string to hex format for XRPL URI field
 */
export function stringToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase();
}

/**
 * Convert hex string back to UTF-8 string
 */
export function hexToString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Encode policy metadata as hex URI
 * Uses compact format to stay within 256-byte limit
 */
export function encodeMetadataAsUri(metadata: PolicyNFTMetadata): string {
  const compact = toCompactMetadata(metadata);
  const json = JSON.stringify(compact);
  
  // Check size limit
  if (json.length > 256) {
    throw new Error(`Metadata JSON exceeds 256 bytes: ${json.length} bytes`);
  }
  
  return stringToHex(json);
}

/**
 * Decode hex URI back to policy metadata
 */
export function decodeUriToMetadata(hexUri: string): Partial<PolicyNFTMetadata> {
  const json = hexToString(hexUri);
  const compact = JSON.parse(json) as CompactPolicyMetadata;
  return fromCompactMetadata(compact);
}

/**
 * NFTokenMint flags
 */
export const NFT_FLAGS = {
  /** Token can be burned by issuer */
  tfBurnable: 1,
  /** Token can only be offered/sold for XRP (native asset) */
  tfOnlyXRP: 2,
  /** Token can be transferred to others */
  tfTransferable: 8,
  /** Token URI can be modified */
  tfMutable: 16,
} as const;

/**
 * Mint a Policy NFT using the Insurer wallet
 * 
 * Note: This function prepares the transaction but uses MCP tools for submission
 * The actual minting is done via the verify script using MCP nft-mint tool
 */
export function preparePolicyNFTMint(
  insurerAddress: string,
  metadata: PolicyNFTMetadata
): {
  account: string;
  uri: string;
  taxon: number;
  flags: number;
  transferFee: number;
} {
  const uriHex = encodeMetadataAsUri(metadata);
  
  return {
    account: insurerAddress,
    uri: uriHex,
    taxon: 1,  // Policy NFT category
    flags: NFT_FLAGS.tfTransferable,  // Allow trading
    transferFee: 0,  // No royalties for insurance policies
  };
}

/**
 * Extract NFTokenID from NFTokenMint transaction result
 * The NFTokenID is computed from the transaction metadata
 */
export function extractNFTokenIdFromMeta(meta: any): string | null {
  if (!meta || typeof meta !== 'object') return null;
  
  const affectedNodes = meta.AffectedNodes || [];
  
  for (const node of affectedNodes) {
    // Look for created NFTokenPage
    const created = node.CreatedNode;
    const modified = node.ModifiedNode;
    
    if (created?.LedgerEntryType === 'NFTokenPage') {
      const nfTokens = created.NewFields?.NFTokens || [];
      if (nfTokens.length > 0) {
        return nfTokens[nfTokens.length - 1]?.NFToken?.NFTokenID;
      }
    }
    
    if (modified?.LedgerEntryType === 'NFTokenPage') {
      const finalTokens = modified.FinalFields?.NFTokens || [];
      const prevTokens = modified.PreviousFields?.NFTokens || [];
      
      // Find the new token (in final but not in previous)
      if (finalTokens.length > prevTokens.length) {
        // The new token is typically the last one added
        for (const token of finalTokens) {
          const tokenId = token?.NFToken?.NFTokenID;
          if (tokenId && !prevTokens.some((p: any) => p?.NFToken?.NFTokenID === tokenId)) {
            return tokenId;
          }
        }
      }
    }
  }
  
  return null;
}
