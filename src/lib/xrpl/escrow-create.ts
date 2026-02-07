import { Client, Wallet, isoTimeToRippleTime, EscrowCreate as EscrowCreateTx } from 'xrpl';
import cc from 'five-bells-condition';
import crypto from 'crypto';
import { rlusdToAmount, type RLUSDAmount } from './wallet-utils';

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
 * Locks RLUSD from insurer to farmer, releasable only with fulfillment
 */
export async function createConditionalEscrow(
  insurerWallet: Wallet,
  farmerAddress: string,
  amountRlusd: number,
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
    
    // Create RLUSD amount object
    const amount = rlusdToAmount(amountRlusd);
    
    // Prepare EscrowCreate transaction
    const escrowTx: EscrowCreateTx = {
      TransactionType: 'EscrowCreate',
      Account: insurerWallet.address,
      Destination: farmerAddress,
      Amount: amount as any, // RLUSD amount object instead of XRP drops
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
 * Get account balance in drops
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
