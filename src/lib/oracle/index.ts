/**
 * Oracle Module Exports
 */

export { OracleService, ESCROW_ERROR_CODES } from './OracleService';
export type {
  OracleServiceConfig,
  TriggerDecision,
  ProcessingResult,
  PolicyForOracle,
  PayoutResult,
  WeatherData,
} from './OracleService';

export { MockPolicyService } from './policy-service';

export {
  fetchCurrentWeather,
  isDroughtCondition,
  calculateDroughtSeverity,
  evaluateRiskViaBackend,
} from './weather-oracle';
