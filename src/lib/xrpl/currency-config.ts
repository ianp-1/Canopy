/**
 * XRPL Currency Configuration
 * 
 * This file contains configuration for working with RLUSD on XRPL Testnet
 */

/**
 * RLUSD Issuer Address on XRPL Testnet
 * Source: Ripple's official RLUSD testnet documentation
 */
export const RLUSD_ISSUER_TESTNET = 'rMxoNHcXa8MggG4viviJT2FqGEhkTTESTa';

/**
 * Currency code for RLUSD
 */
export const RLUSD_CURRENCY = 'RLUSD';

/**
 * Amount object for RLUSD transactions
 * XRPL uses this format for issued currencies (non-XRP)
 */
export interface RLUSDAmount {
  currency: string;
  value: string;
  issuer: string;
}

/**
 * Create an RLUSD amount object for XRPL transactions
 * @param value - The amount as a number or string
 * @returns RLUSD amount object for use in XRPL transactions
 */
export function createRLUSDAmount(value: number | string): RLUSDAmount {
  return {
    currency: RLUSD_CURRENCY,
    value: typeof value === 'number' ? value.toFixed(2) : value, // Use 2 decimal places for consistency
    issuer: RLUSD_ISSUER_TESTNET,
  };
}

/**
 * Parse an RLUSD amount object to a numeric value
 * @param amount - RLUSD amount object or string
 * @returns Numeric value
 */
export function parseRLUSDAmount(amount: RLUSDAmount | string): number {
  if (typeof amount === 'string') {
    return parseFloat(amount);
  }
  return parseFloat(amount.value);
}

/**
 * Format RLUSD amount for display
 * @param amount - RLUSD amount as number or string
 * @returns Formatted string with up to 2 decimal places (consistent with amount creation)
 */
export function formatRLUSDAmount(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  return num.toFixed(2);
}
