import { Wallet } from 'xrpl';
import 'dotenv/config';

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
