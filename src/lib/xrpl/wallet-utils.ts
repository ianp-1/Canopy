import { Wallet } from 'xrpl';
import 'dotenv/config';

/**
 * Minimal type for XRPL issued currency amounts.
 * Defined locally to avoid coupling to xrpl package internals.
 */
export interface IssuedCurrencyAmount {
  currency: string;
  issuer: string;
  value: string;
}

export type WalletRole = 'insurer' | 'farmer' | 'oracle';

interface WalletConfig {
  seed: string;
  address: string;
  publicKey: string;
}

/**
 * RLUSD Configuration for XRPL Testnet
 *
 * RLUSD is an issued currency on the XRP Ledger.
 * The currency code uses the 160-bit hex format since "RLUSD" is longer than 3 characters.
 */
export const RLUSD_CURRENCY_HEX = '524C555344000000000000000000000000000000';

/**
 * RLUSD issuer address on XRPL Testnet.
 * Falls back to the well-known testnet issuer only when NODE_ENV is not production.
 */
const DEFAULT_TESTNET_ISSUER = 'rQhWct2fTR16KeopGMqnGBvnGGGiqECcRi';
export const RLUSD_ISSUER: string = (() => {
  const env = process.env.RLUSD_ISSUER_ADDRESS;
  if (env) return env;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RLUSD_ISSUER_ADDRESS environment variable is required in production');
  }
  return DEFAULT_TESTNET_ISSUER;
})();

/**
 * Build an RLUSD Amount object for XRPL transactions
 */
export function rlusdAmount(value: number | string): IssuedCurrencyAmount {
  return {
    currency: RLUSD_CURRENCY_HEX,
    issuer: RLUSD_ISSUER,
    value: String(value),
  };
}

/**
 * Load a wallet from environment variables based on role
 */
export function getWalletFromEnv(role: WalletRole): Wallet {
  const envKey = `XRPL_${role.toUpperCase()}_SEED`;
  const seed = process.env[envKey];
  
  if (!seed) {
    throw new Error(`Missing ${envKey} in .env file`);
  }
  
  return Wallet.fromSeed(seed);
}

/**
 * Get all three wallets for the escrow lifecycle
 */
export function getAllWallets() {
  return {
    insurer: getWalletFromEnv('insurer'),
    farmer: getWalletFromEnv('farmer'),
    oracle: getWalletFromEnv('oracle'),
  };
}

/**
 * Get wallet addresses for display
 */
export function getWalletAddresses() {
  const wallets = getAllWallets();
  return {
    insurer: wallets.insurer.address,
    farmer: wallets.farmer.address,
    oracle: wallets.oracle.address,
  };
}

/**
 * Format XRP amount from drops to human-readable
 */
export function dropsToXrp(drops: string | number): string {
  const xrp = Number(drops) / 1_000_000;
  return xrp.toFixed(6);
}

/**
 * Convert XRP to drops
 */
export function xrpToDrops(xrp: number): string {
  return String(Math.floor(xrp * 1_000_000));
}
