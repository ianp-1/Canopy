'use server'

import { Xumm } from 'xumm'
import { checkRlusdTrustline, buildTrustlinePayloadTx } from '@/lib/xrpl'
import type { TrustlineStatus } from '@/lib/xrpl'

// Initialize Xumm SDK
const xumm = new Xumm(
  process.env.XUMM_API_KEY!,
  process.env.XUMM_API_SECRET
)

/**
 * Check whether a wallet has an RLUSD trustline.
 * Safe to call from client components via server action.
 */
export async function getTrustlineStatus(walletAddress: string): Promise<TrustlineStatus> {
  if (!walletAddress) {
    return { exists: false, balance: '0', limit: '0' }
  }
  return checkRlusdTrustline(walletAddress)
}

/**
 * Create a Xaman payload for the user to set up an RLUSD trustline.
 * The user scans the QR code / approves in Xaman to sign the TrustSet tx.
 */
export async function createTrustlineRequest() {
  try {
    const trustTx = buildTrustlinePayloadTx()

    const payload = await xumm.payload?.create(trustTx)

    if (!payload) {
      return { success: false as const, error: 'Failed to create trustline payload' }
    }

    return {
      success: true as const,
      qrUrl: payload.refs?.qr_png ?? null,
      payloadId: payload.uuid,
      deepLink: payload.next?.always ?? null,
    }
  } catch (error) {
    console.error('Create Trustline Request Error:', error)
    return { success: false as const, error: 'Failed to create trustline request' }
  }
}
