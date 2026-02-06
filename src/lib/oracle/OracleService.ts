/**
 * Oracle Service
 * Main orchestration module for automated escrow triggers
 * 
 * Monitors weather conditions and triggers EscrowFinish transactions
 * when drought thresholds are met.
 */

import { Wallet } from 'xrpl';
import { finishEscrow, EscrowFinishResult } from '../xrpl/escrow-finish';
import { fetchCurrentWeather, WeatherData, isDroughtCondition, calculateDroughtSeverity } from './weather-oracle';
import { PolicyForOracle, PayoutResult, MockPolicyService } from './policy-service';

/**
 * XRPL error codes for escrow operations
 */
export const ESCROW_ERROR_CODES: Record<string, string> = {
  'tecNO_TARGET': 'Escrow already claimed or does not exist',
  'tecNO_PERMISSION': 'Invalid fulfillment - not authorized',
  'tecCRYPTOCONDITION_ERROR': 'Fulfillment does not match condition',
  'tecPRE_SEQ': 'FinishAfter time not yet reached',
  'tecNO_ENTRY': 'Escrow entry not found',
  'temMALFORMED': 'Transaction malformed - check condition/fulfillment format',
} as const;

/**
 * Trigger decision with reasoning
 */
export interface TriggerDecision {
  shouldTrigger: boolean;
  reason: string;
  weather: WeatherData;
  severity?: number;
  mlScore?: number;
}

/**
 * Processing result for a single policy
 */
export interface ProcessingResult {
  policyId: string;
  decision: TriggerDecision;
  payout?: PayoutResult;
}

/**
 * Oracle Service configuration
 */
export interface OracleServiceConfig {
  /** Oracle wallet for signing transactions */
  oracleWallet: Wallet;
  /** Insurer address (escrow owner) */
  insurerAddress: string;
  /** Policy service for database operations */
  policyService: MockPolicyService;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Oracle Service
 * Coordinates weather monitoring and escrow execution
 */
export class OracleService {
  private oracleWallet: Wallet;
  private insurerAddress: string;
  private policyService: MockPolicyService;
  private verbose: boolean;

  constructor(config: OracleServiceConfig) {
    this.oracleWallet = config.oracleWallet;
    this.insurerAddress = config.insurerAddress;
    this.policyService = config.policyService;
    this.verbose = config.verbose ?? true;
  }

  /**
   * Process all active policies
   * Main entry point for oracle execution
   */
  async processAllPolicies(): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    if (this.verbose) {
      console.log('\n[OracleService] Starting policy processing...');
    }

    const policies = await this.policyService.getActivePolicies();
    
    if (this.verbose) {
      console.log(`[OracleService] Found ${policies.length} active policies`);
    }

    for (const policy of policies) {
      try {
        const result = await this.processPolicy(policy);
        results.push(result);
      } catch (error) {
        console.error(`[OracleService] Error processing policy ${policy.id}:`, error);
        results.push({
          policyId: policy.id,
          decision: {
            shouldTrigger: false,
            reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            weather: { rainfall_mm: 0, temperature_c: 0, humidity_percent: 0, timestamp: new Date(), source: 'mock' },
          },
        });
      }
    }

    return results;
  }

  /**
   * Process a single policy
   */
  async processPolicy(policy: PolicyForOracle): Promise<ProcessingResult> {
    if (this.verbose) {
      console.log(`\n[OracleService] Processing policy ${policy.id}`);
      console.log(`  Coordinates: (${policy.coordinates.lat}, ${policy.coordinates.lng})`);
      console.log(`  Threshold:   ${policy.thresholdRainfall}mm`);
    }

    // Evaluate trigger conditions
    const decision = await this.evaluatePolicy(policy);

    if (this.verbose) {
      console.log(`  Weather:     ${decision.weather.rainfall_mm}mm rainfall`);
      console.log(`  Decision:    ${decision.shouldTrigger ? 'TRIGGER' : 'NO TRIGGER'}`);
      console.log(`  Reason:      ${decision.reason}`);
    }

    // If trigger condition met, execute payout
    let payout: PayoutResult | undefined;
    if (decision.shouldTrigger) {
      payout = await this.triggerPayout(policy);
      
      if (payout.success) {
        await this.policyService.markPolicyClaimed(policy.id, payout.txHash!);
      }
    }

    return {
      policyId: policy.id,
      decision,
      payout,
    };
  }

  /**
   * Evaluate if a policy should trigger payout
   */
  async evaluatePolicy(policy: PolicyForOracle): Promise<TriggerDecision> {
    // Fetch current weather for policy location
    const weather = await fetchCurrentWeather(
      policy.coordinates.lat,
      policy.coordinates.lng
    );

    // Check if drought condition is met
    const isDrought = isDroughtCondition(weather, policy.thresholdRainfall);
    const severity = calculateDroughtSeverity(weather, policy.thresholdRainfall);

    // ═══════════════════════════════════════════════════════════════════════
    // TODO: AI Data Fusion Layer
    // 
    // Insert ML probability score here to weigh the payout decision.
    // 
    // Example integration:
    // const mlScore = await mlService.predictDroughtProbability({
    //   weather,
    //   historicalData: await getHistoricalWeather(policy.coordinates),
    //   satelliteImagery: await getSatelliteData(policy.coordinates),
    // });
    // 
    // if (mlScore < 0.7) {
    //   return {
    //     shouldTrigger: false,
    //     reason: `ML model confidence too low: ${mlScore}`,
    //     weather,
    //     severity,
    //     mlScore,
    //   };
    // }
    // ═══════════════════════════════════════════════════════════════════════

    if (!isDrought) {
      return {
        shouldTrigger: false,
        reason: `Rainfall ${weather.rainfall_mm}mm >= threshold ${policy.thresholdRainfall}mm`,
        weather,
        severity: 0,
      };
    }

    return {
      shouldTrigger: true,
      reason: `Drought detected: ${weather.rainfall_mm}mm < ${policy.thresholdRainfall}mm (severity: ${(severity * 100).toFixed(1)}%)`,
      weather,
      severity,
    };
  }

  /**
   * Execute escrow payout with robust error handling
   */
  async triggerPayout(policy: PolicyForOracle): Promise<PayoutResult> {
    if (this.verbose) {
      console.log(`\n[OracleService] Triggering payout for policy ${policy.id}`);
      console.log(`  Escrow Sequence: ${policy.escrowSequence}`);
      console.log(`  Farmer Wallet:   ${policy.farmerWallet}`);
    }

    try {
      const result = await finishEscrow(
        this.oracleWallet,
        this.insurerAddress,
        policy.escrowSequence,
        policy.condition,
        policy.fulfillment
      );

      if (result.success) {
        if (this.verbose) {
          console.log(`  ✓ Payout successful`);
          console.log(`  Tx Hash: ${result.txHash}`);
        }
        return {
          policyId: policy.id,
          success: true,
          txHash: result.txHash,
        };
      } else {
        // Transaction submitted but failed
        const errorMessage = 'EscrowFinish transaction failed';
        console.error(`  ✗ ${errorMessage}`);
        return {
          policyId: policy.id,
          success: false,
          txHash: result.txHash,
          error: errorMessage,
        };
      }
    } catch (error) {
      // Handle specific XRPL errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let errorCode: string | undefined;

      // Parse error code from message
      for (const [code, description] of Object.entries(ESCROW_ERROR_CODES)) {
        if (errorMessage.includes(code)) {
          errorCode = code;
          console.error(`  ✗ ${code}: ${description}`);
          break;
        }
      }

      if (!errorCode) {
        console.error(`  ✗ Unexpected error: ${errorMessage}`);
      }

      return {
        policyId: policy.id,
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }
}

// Re-export types
export type { PolicyForOracle, PayoutResult, WeatherData };
export { MockPolicyService };
