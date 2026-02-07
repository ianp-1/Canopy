/**
 * Policy Activation API
 * 
 * Orchestrates the full XRPL policy lifecycle after premium payment:
 * 1. EscrowCreate - Lock coverage funds
 * 2. NFTokenMint - Create policy NFT
 * 3. NFTokenCreateOffer - Transfer NFT to farmer
 * 4. Database update - Store all XRPL data
 * 
 * @route POST /api/policy/activate
 */

import { NextRequest, NextResponse } from 'next/server'
import { Wallet } from 'xrpl'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { PolicyStatus } from '@/generated/prisma/client'
import { activatePolicyOnXRPL, getExplorerUrls } from '@/lib/xrpl'

// Load insurer wallet from environment
const INSURER_SEED = process.env.XRPL_INSURER_SEED

export async function POST(request: NextRequest) {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. Validate Request & Authentication
    // ═══════════════════════════════════════════════════════════════════
    
    const body = await request.json()
    const { 
      premiumAmount, 
      crop, 
      riskLevel, 
      coordinates, 
      areaHectares,
      premiumTxHash,
    } = body

    if (!premiumAmount || !premiumTxHash) {
      return NextResponse.json({ 
        error: 'Missing required fields: premiumAmount, premiumTxHash' 
      }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create Prisma user
    let user = await prisma.user.findUnique({
      where: { supabaseUid: supabaseUser.id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get farmer's wallet address
    const farmerAddress = user.walletAddress
    if (!farmerAddress) {
      return NextResponse.json({ 
        error: 'User does not have a linked wallet address' 
      }, { status: 400 })
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. Prepare XRPL Activation
    // ═══════════════════════════════════════════════════════════════════

    if (!INSURER_SEED) {
      return NextResponse.json({ 
        error: 'Server configuration error: XRPL_INSURER_SEED not set' 
      }, { status: 500 })
    }

    const insurerWallet = Wallet.fromSeed(INSURER_SEED)
    
    // Calculate coverage (20x premium)
    const coverageMultiplier = 20
    const coverageAmountXrp = premiumAmount * coverageMultiplier

    // Map crop to policy title
    const cropTitleMap: Record<string, string> = {
      corn: 'Corn Drought Protection',
      soy: 'Soybean Drought Protection',
      wheat: 'Wheat Drought Protection',
    }
    const policyTitle = cropTitleMap[crop] || `${crop} Drought Protection`

    // ═══════════════════════════════════════════════════════════════════
    // 3. Execute XRPL Transactions
    // ═══════════════════════════════════════════════════════════════════

    console.log('🚀 Activating policy on XRPL...')
    
    const activationResult = await activatePolicyOnXRPL({
      insurerWallet,
      farmerAddress,
      coverageAmountXrp,
      premiumAmountXrp: premiumAmount,
      policyTitle,
      coordinates: coordinates || { lat: 0, lng: 0 },
      thresholdRainfall: riskLevel || 10,
    })

    // Get explorer URLs
    const explorerUrls = getExplorerUrls(activationResult)

    // ═══════════════════════════════════════════════════════════════════
    // 4. Store in Database
    // ═══════════════════════════════════════════════════════════════════

    const cropRegionMap: Record<string, string> = {
      corn: 'Corn Belt',
      soy: 'Midwest Soybean',
      wheat: 'Great Plains Wheat',
    }

    const policy = await prisma.policy.create({
      data: {
        userId: user.id,
        region: cropRegionMap[crop] || `${crop} Field`,
        coverageAmount: coverageAmountXrp,
        premiumAmount: premiumAmount,
        
        // XRPL Escrow data (Phase 1)
        escrowSequence: activationResult.escrow.sequence,
        escrowCondition: activationResult.escrow.condition,
        escrowFulfillment: activationResult.escrow.fulfillment,
        xrplEscrowId: activationResult.escrow.txHash,
        
        // NFT data (Phase 2)
        nftTokenId: activationResult.nft.tokenId,
        nftMintTxHash: activationResult.nft.mintTxHash,
        
        // Weather config
        thresholdRainfall: riskLevel || 10,
        coordinates: coordinates,
        
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

    // ═══════════════════════════════════════════════════════════════════
    // 5. Return Success Response
    // ═══════════════════════════════════════════════════════════════════

    return NextResponse.json({
      success: true,
      policyId: policy.id,
      coverageAmount: coverageAmountXrp,
      
      // XRPL data
      escrow: {
        sequence: activationResult.escrow.sequence,
        txHash: activationResult.escrow.txHash,
        explorerUrl: explorerUrls.escrowTx,
      },
      nft: {
        tokenId: activationResult.nft.tokenId,
        mintTxHash: activationResult.nft.mintTxHash,
        explorerUrl: explorerUrls.nftToken,
      },
    })

  } catch (error) {
    console.error('Policy Activation Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
