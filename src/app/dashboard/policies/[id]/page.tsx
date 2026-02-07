import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPolicyDetails } from '../../actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  ExternalLink, 
  ShieldCheck, 
  Wallet, 
  AlertCircle,
  MapPin,
  Droplets,
  Calendar,
  FileText,
  Link2,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { PolicyNFTClaim } from './policy-nft-claim'

interface PolicyDetailsPageProps {
  params: Promise<{ id: string }>
}

// Helper to format date
function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Helper to format datetime
function formatDateTime(date: Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Truncate hash for display
function truncateHash(hash: string | null | undefined, chars = 8) {
  if (!hash) return '—'
  if (hash.length <= chars * 2) return hash
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`
}

// XRPL Testnet Explorer base URL
const EXPLORER_BASE = 'https://testnet.xrpl.org'

export default async function PolicyDetailsPage({ params }: PolicyDetailsPageProps) {
  const { id } = await params
  const policy = await getPolicyDetails(id)
  
  if (!policy) {
    notFound()
  }
  
  const isActive = policy.status === 'ACTIVE'
  const isClaimed = policy.status === 'CLAIMED'
  
  const statusConfig = {
    PENDING: {
      badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: Clock,
      label: 'Pending Approval',
    },
    ACTIVE: {
      badge: 'bg-green-100 text-green-700 border-green-200',
      icon: ShieldCheck,
      label: 'Protected',
    },
    CLAIMED: {
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: Wallet,
      label: 'Claimed',
    },
    EXPIRED: {
      badge: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: AlertCircle,
      label: 'Expired',
    },
    DENIED: {
      badge: 'bg-red-100 text-red-700 border-red-200',
      icon: XCircle,
      label: 'Denied',
    },
  }
  
  const config = statusConfig[policy.status] || statusConfig.EXPIRED
  const StatusIcon = config.icon
  
  // Crop info
  const crop = policy.premiumDetails?.crop || 'wheat'
  const cropInfo: Record<string, { name: string; emoji: string }> = {
    corn: { name: 'Corn', emoji: '🌽' },
    soy: { name: 'Soy', emoji: '🌱' },
    wheat: { name: 'Wheat', emoji: '🌾' },
  }
  const { name: cropName, emoji: cropEmoji } = cropInfo[crop] || { name: crop, emoji: '🌾' }
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{cropEmoji}</span>
            <h1 className="text-2xl font-bold">{cropName} Drought Protection</h1>
          </div>
          <p className="text-muted-foreground mt-1">{policy.region}</p>
        </div>
        <Badge variant="secondary" className={`border ${config.badge} text-sm px-3 py-1`}>
          <StatusIcon className="w-4 h-4 mr-1.5" />
          {config.label}
        </Badge>
      </div>
      
      {/* Status-specific alerts */}
      {policy.status === 'PENDING' && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Pending Insurer Approval</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Your policy has been submitted and is awaiting review and approval from the insurer. 
            Once approved, you'll be able to claim your policy NFT certificate.
          </AlertDescription>
        </Alert>
      )}
      
      {policy.status === 'DENIED' && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Policy Denied</AlertTitle>
          <AlertDescription className="text-red-700">
            Unfortunately, this policy application was not approved by the insurer. 
            Please contact support for more information or submit a new policy application.
          </AlertDescription>
        </Alert>
      )}
      
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Policy Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Policy Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Coverage Amount</span>
              <span className="font-mono font-semibold text-lg">
                {policy.coverageAmount.toLocaleString()} XRP
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Premium Paid</span>
              <span className="font-mono">
                {policy.premiumAmount?.toLocaleString() || '—'} XRP
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Area</span>
              <span className="font-mono">
                {policy.premiumDetails?.areaHectares?.toFixed(1) || '—'} ha
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(policy.createdAt)}</span>
            </div>
            {policy.expiresAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Expires</span>
                <span>{formatDate(policy.expiresAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Weather & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              Weather Trigger
            </CardTitle>
            <CardDescription>
              Payout triggers when conditions are met
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Rainfall Threshold</span>
              <span className="font-mono font-semibold">
                &lt; {policy.thresholdRainfall || 10} mm
              </span>
            </div>
            {policy.coordinates && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> Location
                </span>
                <span className="font-mono text-sm">
                  {policy.coordinates.lat.toFixed(4)}, {policy.coordinates.lng.toFixed(4)}
                </span>
              </div>
            )}
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                {isActive 
                  ? 'The oracle monitors weather conditions daily. If rainfall drops below the threshold, your payout will be triggered automatically.'
                  : isClaimed
                  ? 'Weather conditions met the trigger threshold. Payout has been processed.'
                  : 'This policy has expired without a claim.'}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* XRPL Escrow */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-500" />
              Escrow Details
            </CardTitle>
            <CardDescription>
              Funds locked on XRP Ledger
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Escrow Sequence</span>
              <span className="font-mono">{policy.escrowSequence || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Escrow TX</span>
              {policy.xrplEscrowId ? (
                <a 
                  href={`${EXPLORER_BASE}/transactions/${policy.xrplEscrowId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {truncateHash(policy.xrplEscrowId)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            {isClaimed && policy.claimTxHash && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Claim TX</span>
                <a 
                  href={`${EXPLORER_BASE}/transactions/${policy.claimTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {truncateHash(policy.claimTxHash)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {isClaimed && policy.claimedAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Claimed At</span>
                <span>{formatDateTime(policy.claimedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* NFT Certificate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Policy NFT
            </CardTitle>
            <CardDescription>
              Your insurance certificate on-chain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Token ID</span>
              {policy.nftTokenId ? (
                <a 
                  href={`${EXPLORER_BASE}/nft/${policy.nftTokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {truncateHash(policy.nftTokenId, 6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Mint TX</span>
              {policy.nftMintTxHash ? (
                <a 
                  href={`${EXPLORER_BASE}/transactions/${policy.nftMintTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {truncateHash(policy.nftMintTxHash)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            
            {/* Claim NFT button - shows when NFT exists but user hasn't claimed it yet */}
            {policy.premiumDetails?.nftOfferId && !policy.isNftClaimed && (
              <div className="py-3 border-b">
                <PolicyNFTClaim 
                  offerId={policy.premiumDetails.nftOfferId}
                  policyId={policy.id}
                />
              </div>
            )}
            
            {policy.premiumDetails?.premiumTxHash && (
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Premium TX</span>
                <a 
                  href={`${EXPLORER_BASE}/transactions/${policy.premiumDetails.premiumTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {truncateHash(policy.premiumDetails.premiumTxHash)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Timeline / Oracle Activity */}
      {policy.oracleLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Oracle Activity
            </CardTitle>
            <CardDescription>
              Recent weather checks and actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {policy.oracleLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className={`flex items-start gap-4 ${index !== policy.oracleLogs.length - 1 ? 'pb-4 border-b' : ''}`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-full ${
                    log.action === 'PAYOUT_SUCCESS' 
                      ? 'bg-green-100 text-green-600' 
                      : log.action === 'PAYOUT_FAILED'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {log.action === 'PAYOUT_SUCCESS' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : log.action === 'PAYOUT_FAILED' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {log.action === 'PAYOUT_SUCCESS' 
                        ? 'Payout Triggered'
                        : log.action === 'PAYOUT_FAILED'
                        ? 'Payout Failed'
                        : log.action === 'CHECK_TRIGGERED'
                        ? 'Weather Check'
                        : log.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  {log.txHash && (
                    <a 
                      href={`${EXPLORER_BASE}/transactions/${log.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View TX <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
