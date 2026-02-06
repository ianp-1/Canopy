import { Client, Wallet, EscrowFinish as EscrowFinishTx } from 'xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

export interface EscrowFinishResult {
  txHash: string;
  confirmed: boolean;
  success: boolean;
}

/**
 * Finish a conditional escrow on XRPL
 * Releases locked XRP to the farmer using the provided fulfillment
 * 
 * Note: Any account can submit EscrowFinish, but the fulfillment must match the condition
 */
export async function finishEscrow(
  /** Wallet submitting the finish transaction (typically Oracle) */
  oracleWallet: Wallet,
  /** Address that created the escrow (Insurer) */
  ownerAddress: string,
  /** Sequence number from the EscrowCreate transaction */
  offerSequence: number,
  /** The condition (hex) that was used in EscrowCreate */
  condition: string,
  /** The fulfillment (hex) that satisfies the condition */
  fulfillment: string
): Promise<EscrowFinishResult> {
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    
    // Prepare EscrowFinish transaction
    // Fee needs to be higher for conditional escrows due to fulfillment validation
    const escrowFinishTx: EscrowFinishTx = {
      TransactionType: 'EscrowFinish',
      Account: oracleWallet.address,
      Owner: ownerAddress,
      OfferSequence: offerSequence,
      Condition: condition,
      Fulfillment: fulfillment,
      // Higher fee for fulfillment validation
      Fee: '500',
    };
    
    // Submit and wait for validation
    const result = await client.submitAndWait(escrowFinishTx, {
      wallet: oracleWallet,
    });
    
    const txHash = result.result.hash;
    const confirmed = result.result.validated === true;
    
    // Check if transaction was successful
    const meta = result.result.meta;
    let success = false;
    if (typeof meta === 'object' && meta !== null && 'TransactionResult' in meta) {
      success = meta.TransactionResult === 'tesSUCCESS';
    }
    
    return {
      txHash,
      confirmed,
      success,
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Cancel an expired escrow
 * Can only be done after CancelAfter time has passed
 */
export async function cancelEscrow(
  wallet: Wallet,
  ownerAddress: string,
  offerSequence: number
): Promise<EscrowFinishResult> {
  const client = new Client(TESTNET_URL);
  
  try {
    await client.connect();
    
    const escrowCancelTx = {
      TransactionType: 'EscrowCancel' as const,
      Account: wallet.address,
      Owner: ownerAddress,
      OfferSequence: offerSequence,
    };
    
    const result = await client.submitAndWait(escrowCancelTx, {
      wallet,
    });
    
    const txHash = result.result.hash;
    const confirmed = result.result.validated === true;
    
    const meta = result.result.meta;
    let success = false;
    if (typeof meta === 'object' && meta !== null && 'TransactionResult' in meta) {
      success = meta.TransactionResult === 'tesSUCCESS';
    }
    
    return {
      txHash,
      confirmed,
      success,
    };
  } finally {
    await client.disconnect();
  }
}
