import { Client, Wallet, xrpToDrops, isoTimeToRippleTime, EscrowCreate as EscrowCreateTx, Payment } from 'xrpl';
import cc from 'five-bells-condition';
import crypto from 'crypto';
import { rlusdAmount, RLUSD_CURRENCY_HEX, RLUSD_ISSUER } from './wallet-utils';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

export interface CryptoCondition {
  /** SHA-256 condition in hex (uppercase) */
  condition: string;
  /** Fulfillment in hex (uppercase) */
  fulfillment: string;
  /** Original preimage in hex */
  preimage: string;
}

export interface EscrowCreateResult {
  txHash: string;
  offerSequence: number;
  condition: string;
  fulfillment: string;
  confirmed: boolean;
}

/**
 * Result from an RLUSD payment transaction
 */
export interface RlusdPaymentResult {
  txHash: string;
  confirmed: boolean;
  success: boolean;
}

/**
 * Generate a PREIMAGE-SHA-256 crypto-condition pair
 * Used for conditional escrows on XRPL
 */
export function generateCryptoCondition(): CryptoCondition {
  // Generate random 32-byte preimage
  const preimage = crypto.randomBytes(32);
  
  // Create SHA-256 fulfillment from preimage
  const fulfillment = new cc.PreimageSha256();
  fulfillment.setPreimage(preimage);
  
  // Get condition (hash of fulfillment) and fulfillment binary
  const conditionBinary = fulfillment.getConditionBinary();
  const fulfillmentBinary = fulfillment.serializeBinary();
  
  return {
    condition: conditionBinary.toString('hex').toUpperCase(),
    fulfillment: fulfillmentBinary.toString('hex').toUpperCase(),
    preimage: preimage.toString('hex'),
  };
}

/**
 * Create a conditional escrow on XRPL
 * Note: XRPL escrows only support native XRP. For RLUSD coverage,
 * use sendRlusdPayment() for direct payouts instead.
 */
export async function createConditionalEscrow(
  insurerWallet: Wallet,
  farmerAddress: string,
  amountXrp: number,
  /** Optional: seconds until escrow can be finished (default: 1 second for testing) */
  finishDelaySeconds: number = 1
): Promise<EscrowCreateResult> {
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    
    // Generate crypto-condition
    const { condition, fulfillment, preimage } = generateCryptoCondition();
    
    // Calculate finishAfter timestamp (Ripple epoch seconds)
    const finishAfterDate = new Date(Date.now() + (finishDelaySeconds * 1000));
    const finishAfter = isoTimeToRippleTime(finishAfterDate.toISOString());
    
    // Prepare EscrowCreate transaction
    const escrowTx: EscrowCreateTx = {
      TransactionType: 'EscrowCreate',
      Account: insurerWallet.address,
      Destination: farmerAddress,
      Amount: xrpToDrops(amountXrp),
      Condition: condition,
      FinishAfter: finishAfter,
    };
    
    // Submit and wait for validation
    const result = await client.submitAndWait(escrowTx, {
      wallet: insurerWallet,
    });
    
    // Extract the Sequence number from the submitted transaction
    // This is what we need for EscrowFinish's OfferSequence field
    const txJson = result.result.tx_json as { Sequence?: number };
    const offerSequence = txJson?.Sequence ?? 0;
    
    if (offerSequence === 0) {
      throw new Error('Failed to get transaction Sequence number from EscrowCreate result');
    }
    
    const txHash = result.result.hash;
    const confirmed = result.result.validated === true;
    
    return {
      txHash,
      offerSequence,
      condition,
      fulfillment,
      confirmed,
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Send an RLUSD payment from one wallet to another on XRPL Testnet.
 * Used for both premium payments and coverage payouts since XRPL escrows
 * only support native XRP, not issued currencies like RLUSD.
 */
export async function sendRlusdPayment(
  senderWallet: Wallet,
  destinationAddress: string,
  amount: number | string,
): Promise<RlusdPaymentResult> {
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: senderWallet.address,
      Destination: destinationAddress,
      Amount: rlusdAmount(amount),
    };
    
    const result = await client.submitAndWait(paymentTx, {
      wallet: senderWallet,
    });
    
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
 * Get account balance in drops (native XRP)
 */
export async function getAccountBalance(address: string): Promise<string> {
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });
    
    return response.result.account_data.Balance;
  } finally {
    await client.disconnect();
  }
}

/**
 * Get RLUSD token balance for an account
 */
export async function getRlusdBalance(address: string): Promise<string> {
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    const response = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
    });
    
    const rlusdLine = response.result.lines.find(
      (line: any) => line.currency === RLUSD_CURRENCY_HEX && line.account === RLUSD_ISSUER
    );
    
    return rlusdLine?.balance ?? '0';
  } finally {
    await client.disconnect();
  }
}
