'use server'

import { Xumm } from 'xumm'
import { Wallet } from 'xrpl'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { PolicyStatus } from '@/generated/prisma/client'
import { activatePolicyOnXRPL, getExplorerUrls, rlusdToAmount } from '@/lib/xrpl'
import { revalidatePath } from 'next/cache'

// Initialize Xumm SDK
const xumm = new Xumm(
  process.env.XUMM_API_KEY!,
  process.env.XUMM_API_SECRET
)

// Insurer's wallet receives premium payments
const INSURER_ADDRESS = process.env.INSURER_WALLET_ADDRESS || 'rNmCuyjQCeeQ12e4SgkDg75HTMz8e7DjE'
const INSURER_SEED = process.env.XRPL_INSURER_SEED

// Types
interface PaymentRequestData {
  crop: string
  riskLevel: number
  areaHectares?: number
}

interface ActivatePolicyData {
  premiumAmount: number
  crop: string
  riskLevel: number
  coordinates?: { lat: number; lng: number }
  geometry?: any // GeoJSON
  areaHectares?: number
  premiumTxHash: string
  cropThresholds?: {
    weeklyRainNeedMm: number
    heatThresholdK: number
    vpdThresholdKpa: number
  }
}

// ... (lines 40-137 skipped)

// ... (interfaces)

/**
 * Creates a Xaman payment payload for policy premium
 */
export async function createPaymentRequest(amountRlusd: number, policyData: PaymentRequestData) {
  try {
    if (!amountRlusd || amountRlusd <= 0) {
      return { success: false, error: 'Invalid amount' }
    }

    // Convert RLUSD to amount object for XRPL
    const amount = rlusdToAmount(amountRlusd)

    // Create payment payload with Xaman
    const payload = await xumm.payload?.create({
      TransactionType: 'Payment',
      Destination: INSURER_ADDRESS,
      Amount: amount as any, // RLUSD amount object
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('policy/premium').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              crop: policyData.crop,
              risk: policyData.riskLevel,
              area: policyData.areaHectares,
            })).toString('hex').toUpperCase(),
          }
        }
      ]
    })

    if (!payload) {
      return { success: false, error: 'Failed to create payment payload' }
    }

    return {
      success: true,
      qrUrl: payload.refs?.qr_png,
      payloadId: payload.uuid,
      deepLink: payload.next?.always,
      amountRlusd,
    }
  } catch (error) {
    console.error('Create Payment Error:', error)
    return { success: false, error: 'Internal Server Error' }
  }
}

/**
 * Checks the status of a Xaman payment payload
 */
export async function checkPaymentStatus(payloadId: string) {
  try {
    if (!payloadId) {
      return { error: 'Missing payload ID' }
    }

    // Get payload status from Xaman
    const payload = await xumm.payload?.get(payloadId)

    if (!payload) {
      return { error: 'Payload not found' }
    }

    // Check if signed
    if (payload.meta.signed) {
      const txHash = payload.response.txid
      const account = payload.response.account

      return {
        signed: true,
        txHash,
        account,
        dispatchedResult: payload.response.dispatched_result,
      }
    }

    // Check if rejected or expired
    if (payload.meta.resolved && !payload.meta.signed) {
      return {
        signed: false,
        rejected: true,
        expired: payload.meta.expired,
      }
    }

    // Still pending
    return {
      pending: true,
      opened: payload.meta.app_opened,
    }
  } catch (error) {
    console.error('Payment Check Error:', error)
    return { error: 'Internal Server Error' }
  }
}

/**
 * Activates the policy on XRPL after successful payment
 */
export async function activatePolicy(data: ActivatePolicyData) {
  try {
    const { 
      premiumAmount, 
      crop, 
      riskLevel, 
      coordinates, 
      geometry,
      areaHectares,
      premiumTxHash,
      cropThresholds,
    } = data

    if (!premiumAmount || !premiumTxHash) {
      return { success: false, error: 'Missing required fields' }
    }

    // 1. Authentication
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get or create Prisma user
    const user = await prisma.user.findUnique({
      where: { supabaseUid: supabaseUser.id }
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const farmerAddress = user.walletAddress
    if (!farmerAddress) {
      return { success: false, error: 'User does not have a linked wallet address' }
    }

    // 2. Prepare XRPL Activation
    if (!INSURER_SEED) {
      return { success: false, error: 'Server configuration error: XRPL_INSURER_SEED not set' }
    }

    const insurerWallet = Wallet.fromSeed(INSURER_SEED)
    
    // Calculate coverage (20x premium)
    const coverageMultiplier = 20
    const coverageAmountRlusd = premiumAmount * coverageMultiplier

    // Map crop to policy title
    const cropTitleMap: Record<string, string> = {
      corn: 'Corn Drought Protection',
      soy: 'Soybean Drought Protection',
      wheat: 'Wheat Drought Protection',
    }
    const policyTitle = cropTitleMap[crop] || `${crop} Drought Protection`

    // 3. Execute XRPL Transactions
    console.log('🚀 Activating policy on XRPL...')
    
    const activationResult = await activatePolicyOnXRPL({
      insurerWallet,
      farmerAddress,
      coverageAmountRlusd,
      premiumAmountRlusd: premiumAmount,
      policyTitle,
      coordinates: coordinates || { lat: 0, lng: 0 },
      thresholdRainfall: riskLevel || 10,
    })

    // Get explorer URLs (include insurer address for account NFT lookup)
    const explorerUrls = getExplorerUrls(activationResult, insurerWallet.address)

    // 4. Store in Database
    const cropRegionMap: Record<string, string> = {
      corn: 'Corn Belt',
      soy: 'Midwest Soybean',
      wheat: 'Great Plains Wheat',
    }

    const policy = await prisma.policy.create({
      data: {
        userId: user.id,
        region: cropRegionMap[crop] || `${crop} Field`,
        coverageAmount: coverageAmountRlusd,
        premiumAmount: premiumAmount,
        
        // XRPL Escrow fields
        escrowSequence: activationResult.escrow.sequence,
        escrowCondition: activationResult.escrow.condition,
        escrowFulfillment: activationResult.escrow.fulfillment,
        xrplEscrowId: activationResult.escrow.txHash,
        
        // NFT fields
        nftTokenId: activationResult.nft.tokenId,
        nftMintTxHash: activationResult.nft.mintTxHash,
        
        // Weather config
        thresholdRainfall: riskLevel || 10,
        coordinates: coordinates ? JSON.parse(JSON.stringify(coordinates)) : undefined,
        geometry: geometry ? JSON.parse(JSON.stringify(geometry)) : undefined,
        
        // Crop threshold fields for oracle evaluation
        weeklyRainNeedMm: cropThresholds?.weeklyRainNeedMm,
        heatThresholdK: cropThresholds?.heatThresholdK,
        vpdThresholdKpa: cropThresholds?.vpdThresholdKpa,
        
        // Premium details
        premiumDetails: {
          crop,
          areaHectares,
          premiumTxHash,
          nftOfferTxHash: activationResult.nft.offerTxHash,
          nftOfferId: activationResult.nft.offerId,
          activatedAt: new Date().toISOString(),
        },
        
        status: PolicyStatus.ACTIVE,
      }
    })

    console.log(`✅ Policy ${policy.id} created and activated on XRPL`)
    
    revalidatePath('/dashboard')

    return {
      success: true,
      policyId: policy.id,
      coverageAmount: coverageAmountRlusd,
      escrow: {
        sequence: activationResult.escrow.sequence,
        txHash: activationResult.escrow.txHash,
        explorerUrl: explorerUrls.escrowTx,
      },
      nft: {
        tokenId: activationResult.nft.tokenId,
        mintTxHash: activationResult.nft.mintTxHash,
        // Offer ID needed for farmer to accept the NFT
        offerId: activationResult.nft.offerId,
        // Use mint transaction URL for immediate verification (NFT token page may take time to index)
        explorerUrl: explorerUrls.nftMintTx,
        // Also provide direct NFT URL (may take a few minutes to appear)
        tokenUrl: explorerUrls.nftToken,
      },
    }

  } catch (error) {
    console.error('Policy Activation Error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal Server Error',
    }
  }
}

/**
 * Creates a Xaman payload for the farmer to accept the NFT sell offer
 * This transfers the policy NFT from the insurer to the farmer's wallet
 */
export async function createNFTAcceptRequest(offerId: string) {
  try {
    if (!offerId) {
      return { success: false, error: 'Missing NFT offer ID' }
    }

    // Create NFTokenAcceptOffer payload with Xaman
    const payload = await xumm.payload?.create({
      TransactionType: 'NFTokenAcceptOffer',
      NFTokenSellOffer: offerId,
    })

    if (!payload) {
      return { success: false, error: 'Failed to create NFT accept payload' }
    }

    return {
      success: true,
      qrUrl: payload.refs?.qr_png,
      payloadId: payload.uuid,
      deepLink: payload.next?.always,
    }
  } catch (error) {
    console.error('Create NFT Accept Error:', error)
    return { success: false, error: 'Failed to create NFT accept request' }
  }
}

/**
 * Checks if the NFT accept offer was signed
 */
export async function checkNFTAcceptStatus(payloadId: string) {
  try {
    if (!payloadId) {
      return { error: 'Missing payload ID' }
    }

    const payload = await xumm.payload?.get(payloadId)

    if (!payload) {
      return { error: 'Payload not found' }
    }

    if (payload.meta.signed) {
      return {
        signed: true,
        txHash: payload.response.txid,
        account: payload.response.account,
      }
    }

    if (payload.meta.resolved && !payload.meta.signed) {
      return {
        signed: false,
        rejected: true,
        expired: payload.meta.expired,
      }
    }

    return {
      pending: true,
      opened: payload.meta.app_opened,
    }
  } catch (error) {
    console.error('NFT Accept Check Error:', error)
    return { error: 'Internal Server Error' }
  }
}

/**
 * Verifies if a user's wallet holds a specific NFT
 */
export async function verifyNFTOwnership(walletAddress: string, tokenId: string) {
  try {
    if (!walletAddress || !tokenId) return false
    
    // Connect to XRPL
    const { Client } = require('xrpl')
    const client = new Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()
    
    try {
      const response = await client.request({
        command: "account_nfts",
        account: walletAddress,
      })
      
      const nfts = response.result.account_nfts
      const hasNft = nfts.some((nft: any) => nft.NFTokenID === tokenId)
      
      await client.disconnect()
      return hasNft
    } catch (e) {
      console.error("Error fetching account NFTs:", e)
      await client.disconnect()
      return false
    }
  } catch (error) {
    console.error("Verify NFT Ownership Error:", error)
    return false
  }
}
