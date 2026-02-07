/**
 * Policy Service Module
 * Handles database operations for oracle processing
 */

// ═══════════════════════════════════════════════════════════════════════
// NOTE: This module is designed for Prisma/Supabase integration
// For testing without database, use MockPolicyService
// ═══════════════════════════════════════════════════════════════════════

/**
 * Policy data required for oracle processing
 */
export interface PolicyForOracle {
  /** Database policy ID */
  id: string;
  /** Coverage amount in RLUSD */
  coverageAmount: number;
  /** EscrowCreate sequence number (legacy, may be 0 for RLUSD policies) */
  escrowSequence: number;
  /** Rainfall threshold in mm */
  thresholdRainfall: number;
  /** Farmer's XRPL wallet address */
  farmerWallet: string;
  /** Geographic coordinates for weather lookup */
  coordinates: {
    lat: number;
    lng: number;
  };
  /** Crypto-condition hex from commitment */
  condition: string;
  /** Fulfillment secret hex for payout verification */
  fulfillment: string;
  /** Insurer's XRPL wallet address */
  insurerAddress: string;
}

/**
 * Result of a payout operation
 */
export interface PayoutResult {
  policyId: string;
  success: boolean;
  txHash?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Mock policy service for testing without database
 */
export class MockPolicyService {
  private policies: PolicyForOracle[] = [];
  private claimedPolicies: Map<string, { txHash: string; claimedAt: Date }> = new Map();

  /**
   * Add a mock policy for testing
   */
  addPolicy(policy: PolicyForOracle): void {
    this.policies.push(policy);
  }

  /**
   * Get all active policies
   */
  async getActivePolicies(): Promise<PolicyForOracle[]> {
    return this.policies.filter(p => !this.claimedPolicies.has(p.id));
  }

  /**
   * Mark a policy as claimed
   */
  async markPolicyClaimed(policyId: string, txHash: string): Promise<void> {
    this.claimedPolicies.set(policyId, {
      txHash,
      claimedAt: new Date(),
    });
    console.log(`[PolicyService] Policy ${policyId} marked as CLAIMED`);
    console.log(`[PolicyService] Tx Hash: ${txHash}`);
  }

  /**
   * Clear all policies (for testing)
   */
  clear(): void {
    this.policies = [];
    this.claimedPolicies.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TODO: Implement PrismaPolicyService for production use
//
// import { PrismaClient } from '@prisma/client';
//
// export class PrismaPolicyService {
//   constructor(private prisma: PrismaClient) {}
//
//   async getActivePolicies(): Promise<PolicyForOracle[]> {
//     const policies = await this.prisma.policy.findMany({
//       where: { status: 'ACTIVE' },
//       include: { user: true },
//     });
//
//     return policies.map(p => ({
//       id: p.id,
//       escrowSequence: p.escrowSequence!,
//       thresholdRainfall: p.thresholdRainfall!,
//       farmerWallet: p.user.walletAddress,
//       coordinates: p.coordinates as { lat: number; lng: number },
//       condition: p.escrowCondition!,
//       fulfillment: p.escrowFulfillment!,
//       insurerAddress: INSURER_ADDRESS, // From env
//     }));
//   }
//
//   async markPolicyClaimed(policyId: string, txHash: string): Promise<void> {
//     await this.prisma.policy.update({
//       where: { id: policyId },
//       data: {
//         status: 'CLAIMED',
//         claimTxHash: txHash,
//         claimedAt: new Date(),
//       },
//     });
//   }
// }
// ═══════════════════════════════════════════════════════════════════════
