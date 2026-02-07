'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, 
  User, 
  Calendar, 
  DollarSign, 
  CloudRain, 
  Thermometer, 
  Droplet,
  Hash,
  ExternalLink,
  Loader2,
  Check,
  X,
  Clock,
  Activity
} from 'lucide-react'
import { 
  getPolicyForInsurer, 
  approvePolicy, 
  denyPolicy,
  type PolicyDetail 
} from '@/app/dashboard/insurer-actions'
import { useRouter } from 'next/navigation'

interface PolicyDetailModalProps {
  policyId: string | null
  isOpen: boolean
  onClose: () => void
}

export function PolicyDetailModal({ policyId, isOpen, onClose }: PolicyDetailModalProps) {
  const [policy, setPolicy] = useState<PolicyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (policyId && isOpen) {
      setIsLoading(true)
      getPolicyForInsurer(policyId)
        .then(data => setPolicy(data))
        .catch(err => console.error('Failed to fetch policy:', err))
        .finally(() => setIsLoading(false))
    } else {
      setPolicy(null)
    }
  }, [policyId, isOpen])

  const handleApprove = async () => {
    if (!policyId) return
    setIsProcessing(true)
    try {
      await approvePolicy(policyId)
      router.refresh()
      onClose()
    } catch (error) {
      console.error('Failed to approve:', error)
      alert('Failed to approve policy')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeny = async () => {
    if (!policyId || !confirm('Are you sure you want to deny this policy?')) return
    setIsProcessing(true)
    try {
      await denyPolicy(policyId)
      router.refresh()
      onClose()
    } catch (error) {
      console.error('Failed to deny:', error)
      alert('Failed to deny policy')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700 border-green-200'
      case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'CLAIMED': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'DENIED': return 'bg-red-100 text-red-700 border-red-200'
      case 'EXPIRED': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !policy ? (
          <div className="py-12 text-center text-muted-foreground">
            Policy not found or access denied.
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">{policy.region}</DialogTitle>
                <Badge className={getStatusColor(policy.status)}>
                  {policy.status}
                </Badge>
              </div>
              <DialogDescription className="flex items-center gap-2 text-sm">
                <Hash className="h-3 w-3" />
                {policy.id.slice(0, 8)}...{policy.id.slice(-8)}
              </DialogDescription>
            </DialogHeader>

            {/* Farmer Info */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{policy.farmerName}</p>
                  {policy.farmerWallet && (
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                      {policy.farmerWallet}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Coverage & Premium */}
              <div className="grid grid-cols-2 gap-4">
                <InfoCard 
                  icon={DollarSign}
                  label="Coverage Amount"
                  value={`${policy.coverageAmount.toLocaleString()} XRP`}
                />
                <InfoCard 
                  icon={DollarSign}
                  label="Premium Paid"
                  value={`${policy.premiumAmount.toLocaleString()} XRP`}
                />
                <InfoCard 
                  icon={Calendar}
                  label="Created"
                  value={formatDate(policy.createdAt)}
                />
                <InfoCard 
                  icon={Clock}
                  label="Expires"
                  value={formatDate(policy.expiresAt)}
                />
              </div>

              <Separator />

              {/* Location & Crop */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Coverage Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoCard 
                    icon={MapPin}
                    label="Region"
                    value={policy.region}
                  />
                  <InfoCard 
                    icon={Activity}
                    label="Crop Type"
                    value={policy.crop}
                  />
                  {policy.coordinates && (
                    <div className="col-span-2 text-xs text-muted-foreground font-mono">
                      📍 {policy.coordinates.lat.toFixed(4)}, {policy.coordinates.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Weather Thresholds */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  Trigger Thresholds
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <InfoCard 
                    icon={CloudRain}
                    label="Rainfall"
                    value={policy.thresholdRainfall ? `< ${policy.thresholdRainfall}mm` : 'N/A'}
                  />
                  <InfoCard 
                    icon={Thermometer}
                    label="Temperature"
                    value={policy.thresholdTemp ? `${policy.thresholdTemp}°C` : 'N/A'}
                  />
                  <InfoCard 
                    icon={Droplet}
                    label="Soil Moisture"
                    value={policy.thresholdSoilMoisture ? `${policy.thresholdSoilMoisture}%` : 'N/A'}
                  />
                </div>
              </div>

              {/* Escrow & NFT Details */}
              {(policy.escrowSequence || policy.nftTokenId) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      On-Chain Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      {policy.escrowSequence && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Escrow Sequence</span>
                          <span className="font-mono">#{policy.escrowSequence}</span>
                        </div>
                      )}
                      {policy.nftTokenId && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">NFT Token</span>
                          <span className="font-mono text-xs truncate max-w-[200px]">
                            {policy.nftTokenId.slice(0, 8)}...{policy.nftTokenId.slice(-8)}
                          </span>
                        </div>
                      )}
                      {policy.claimTxHash && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Claim TX</span>
                          <a 
                            href={`https://testnet.xrpl.org/transactions/${policy.claimTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline text-xs font-mono"
                          >
                            {policy.claimTxHash.slice(0, 8)}...
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Oracle Logs */}
              {policy.oracleLogs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      Oracle History
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {policy.oracleLogs.map(log => (
                        <div 
                          key={log.id} 
                          className="flex justify-between items-center text-xs p-2 bg-muted/30 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {log.action}
                            </Badge>
                            {log.consensusScore !== null && (
                              <span className="text-muted-foreground">
                                Score: {(log.consensusScore * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <DialogFooter className="mt-6">
              {policy.status === 'PENDING' ? (
                <div className="flex gap-2 w-full justify-end">
                  <Button
                    variant="destructive"
                    onClick={handleDeny}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Deny
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InfoCard({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType
  label: string
  value: string 
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm">{value}</p>
      </div>
    </div>
  )
}
