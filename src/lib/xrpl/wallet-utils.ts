import { Wallet } from 'xrpl';
import 'dotenv/config';
import { createRLUSDAmount, type RLUSDAmount } from './currency-config';

export type WalletRole = 'insurer' | 'farmer' | 'oracle';

interface WalletConfig {
  seed: string;
  address: string;
  publicKey: string;
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
 * @deprecated Use RLUSD amounts instead
 */
export function dropsToXrp(drops: string | number): string {
  const xrp = Number(drops) / 1_000_000;
  return xrp.toFixed(6);
}

/**
 * Convert XRP to drops
 * @deprecated Use RLUSD amounts instead
 */
export function xrpToDrops(xrp: number): string {
  return String(Math.floor(xrp * 1_000_000));
}

/**
 * Convert RLUSD amount to XRPL amount object
 * This is the primary function for creating amounts in this project
 */
export function rlusdToAmount(rlusd: number): RLUSDAmount {
  return createRLUSDAmount(rlusd);
}

/**
 * Parse RLUSD amount object or string to number
 */
export function amountToRlusd(amount: RLUSDAmount | string): number {
  if (typeof amount === 'string') {
    return parseFloat(amount);
  }
  return parseFloat(amount.value);
}

/**
 * Format RLUSD amount for display
 */
export function formatRlusd(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  return num.toFixed(2); // 2 decimal places for currency display
}
