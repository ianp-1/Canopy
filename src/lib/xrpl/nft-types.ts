/**
 * Policy NFT Metadata Schema
 * Stored in the URI field of XLS-20 NFTs (hex-encoded JSON)
 */
export interface PolicyNFTMetadata {
  /** Human-readable name for wallet display */
  name: string;
  
  /** Type of insurance policy, e.g., "Drought Protection" */
  policy_type: string;
  
  /** Geographic coordinates of the insured area */
  coordinates: {
    lat: number;
    lng: number;
  };
  
  /** Trigger condition, e.g., "Rainfall < 10mm" */
  threshold: string;
  
  /** Payout amount in XRP drops (as string for precision) */
  payout_amount: string;
  
  /** Sequence number of the linked Phase 1 escrow */
  escrow_sequence: number;
  
  /** ISO date when policy becomes active */
  issue_date: string;
  
  /** ISO date when policy expires */
  expiry_date: string;
}

/**
 * Compact metadata for fitting within 256-byte URI limit
 * Uses abbreviated field names
 */
export interface CompactPolicyMetadata {
  /** Human-readable name */
  n: string;
  /** Policy type abbreviation */
  t: string;
  /** Latitude */
  la: number;
  /** Longitude */
  lo: number;
  /** Threshold condition */
  th: string;
  /** Payout in drops */
  p: string;
  /** Escrow sequence */
  es: number;
}

/**
 * Result from NFT minting operation
 */
export interface NFTMintResult {
  /** The unique NFToken ID (64-character hex) */
  nftTokenId: string;
  /** Transaction hash */
  txHash: string;
  /** Whether transaction was validated */
  confirmed: boolean;
  /** The hex-encoded URI */
  uriHex: string;
}

/**
 * Result from NFT transfer operation
 */
export interface NFTTransferResult {
  /** Sell offer transaction hash */
  offerTxHash: string;
  /** Accept offer transaction hash */
  acceptTxHash: string;
  /** Whether transfer completed successfully */
  success: boolean;
}

/**
 * Convert full metadata to compact format
 */
export function toCompactMetadata(meta: PolicyNFTMetadata): CompactPolicyMetadata {
  return {
    n: meta.name,
    t: meta.policy_type,
    la: meta.coordinates.lat,
    lo: meta.coordinates.lng,
    th: meta.threshold,
    p: meta.payout_amount,
    es: meta.escrow_sequence,
  };
}

/**
 * Convert compact metadata back to full format
 */
export function fromCompactMetadata(compact: CompactPolicyMetadata): Partial<PolicyNFTMetadata> {
  return {
    name: compact.n,
    policy_type: compact.t,
    coordinates: { lat: compact.la, lng: compact.lo },
    threshold: compact.th,
    payout_amount: compact.p,
    escrow_sequence: compact.es,
  };
}
