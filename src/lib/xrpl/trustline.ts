/**
 * RLUSD Trustline Management for XRPL
 * 
 * On the XRP Ledger, accounts cannot hold, receive, or use an issued
 * currency (like RLUSD) unless they have first established a TrustLine
 * to the issuer. This module provides utilities to:
 * 
 * 1. Check if an account has an RLUSD trustline
 * 2. Create a trustline from a server-side wallet (insurer setup)
 * 3. Create Xaman (Xumm) payloads for farmer trustline setup
 * 
 * @module xrpl/trustline
 */

import { Client, Wallet, TrustSet } from 'xrpl';
import { RLUSD_CURRENCY_HEX, RLUSD_ISSUER } from './wallet-utils';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

/** Default RLUSD trust limit — high enough for coverage payouts */
const DEFAULT_TRUST_LIMIT = '1000000';

export interface TrustlineStatus {
  /** Whether the account has an active RLUSD trustline */
  exists: boolean;
  /** Current RLUSD balance (if trustline exists) */
  balance: string;
  /** Trust limit set on the line */
  limit: string;
}

export interface TrustlineResult {
  txHash: string;
  confirmed: boolean;
  success: boolean;
}

/**
 * Check whether an account has an RLUSD trustline to the configured issuer.
 */
export async function checkRlusdTrustline(address: string): Promise<TrustlineStatus> {
  const client = new Client(TESTNET_URL);

  try {
    await client.connect();

    const response = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
    });

    const rlusdLine = response.result.lines.find(
      (line: { currency: string; account: string; balance: string; limit: string }) =>
        line.currency === RLUSD_CURRENCY_HEX && line.account === RLUSD_ISSUER,
    );

    if (rlusdLine) {
      return {
        exists: true,
        balance: rlusdLine.balance,
        limit: rlusdLine.limit,
      };
    }

    return { exists: false, balance: '0', limit: '0' };
  } catch (error: any) {
    // actNotFound means the account doesn't exist on ledger yet
    if (error?.data?.error === 'actNotFound') {
      return { exists: false, balance: '0', limit: '0' };
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Create an RLUSD trustline from a server-controlled wallet.
 * Used to set up the insurer wallet's trustline during deployment.
 */
export async function createRlusdTrustline(
  wallet: Wallet,
  limit: string = DEFAULT_TRUST_LIMIT,
): Promise<TrustlineResult> {
  const client = new Client(TESTNET_URL);

  try {
    await client.connect();

    const trustSetTx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: RLUSD_CURRENCY_HEX,
        issuer: RLUSD_ISSUER,
        value: limit,
      },
    };

    const result = await client.submitAndWait(trustSetTx, { wallet });

    const txHash = result.result.hash;
    const confirmed = result.result.validated === true;

    const meta = result.result.meta;
    let success = false;
    if (typeof meta === 'object' && meta !== null && 'TransactionResult' in meta) {
      success = meta.TransactionResult === 'tesSUCCESS';
    }

    return { txHash, confirmed, success };
  } finally {
    await client.disconnect();
  }
}

/**
 * Build a TrustSet transaction object suitable for creating a
 * Xaman (Xumm) payload. The farmer signs this in their wallet app
 * to establish the RLUSD trustline.
 */
export function buildTrustlinePayloadTx(limit: string = DEFAULT_TRUST_LIMIT) {
  return {
    TransactionType: 'TrustSet' as const,
    LimitAmount: {
      currency: RLUSD_CURRENCY_HEX,
      issuer: RLUSD_ISSUER,
      value: limit,
    },
  };
}
