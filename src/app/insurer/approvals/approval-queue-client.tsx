"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin, 
  Wheat, 
  Shield, 
  DollarSign,
  User,
  Wallet,
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { approvePolicy, denyPolicy } from "@/app/insurer/actions"
import { useToast } from "@/hooks/use-toast"

// Type for serialized pending policy from server action
interface AgentReview {
  recommendation: string
  risk_score: number | null
  risk_level: string | null
  premium_xrp: number | null
  reasoning_log: Array<{ phase?: string; decision?: string; confidence?: number; steps?: string[] }> | null
  reviewedAt: string | null
}

interface PendingPolicy {
  id: string
  userId: string
  region: string
  coverageAmount: number
  premiumAmount: number | null
  premiumDetails: Record<string, unknown> | null
  status: string
  coordinates: { lat: number; lng: number } | null
  thresholdRainfall: number | null
  createdAt: string
  expiresAt: string | null
  user: {
    id: string
    email: string | null
    walletAddress: string | null
  }
  agentReview: AgentReview | null
}

interface ApprovalQueueClientProps {
  policies: PendingPolicy[]
}

export function ApprovalQueueClient({ policies }: ApprovalQueueClientProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<PendingPolicy | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDenyDialogOpen, setIsDenyDialogOpen] = useState(false)
  const [policyToAction, setPolicyToAction] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleViewDetails(policy: PendingPolicy) {
    setSelectedPolicy(policy)
    setIsDetailOpen(true)
  }

  function handleApprove(policyId: string) {
    startTransition(async () => {
      const result = await approvePolicy(policyId)
      if (result.success) {
        toast({
          title: "Policy Approved",
          description: "The policy is now active and the farmer can use their coverage.",
        })
        setIsDetailOpen(false)
      } else {
        toast({
          variant: "destructive",
          title: "Approval Failed",
          description: result.error || "Failed to approve policy",
        })
      }
    })
  }

  function handleDenyClick(policyId: string) {
    setPolicyToAction(policyId)
    setIsDenyDialogOpen(true)
  }

  function handleDenyConfirm() {
    if (!policyToAction) return
    
    startTransition(async () => {
      const result = await denyPolicy(policyToAction)
      if (result.success) {
        toast({
          title: "Policy Denied",
          description: "The policy application has been denied.",
        })
        setIsDenyDialogOpen(false)
        setIsDetailOpen(false)
        setPolicyToAction(null)
      } else {
        toast({
          variant: "destructive",
          title: "Denial Failed",
          description: result.error || "Failed to deny policy",
        })
      }
    })
  }

  function formatCurrency(amount: number) {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k XRP`
    }
    return `${amount.toFixed(0)} XRP`
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getCropFromDetails(details: Record<string, unknown> | null): string {
    if (!details || !details.crop) return 'Unknown'
    const crop = String(details.crop)
    return crop.charAt(0).toUpperCase() + crop.slice(1)
  }

  if (policies.length === 0) {
    return (
      <Card className="border-none shadow-sm bg-white flex-1">
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="text-xl font-semibold text-[#1B3A2B] mb-2">All Caught Up!</h3>
          <p className="text-muted-foreground max-w-md">
            There are no pending policy applications to review at this time. 
            New applications will appear here when farmers submit them.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-none shadow-sm bg-white flex-1 flex flex-col">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-[#1B3A2B] flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Applications
              <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">
                {policies.length}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="w-[200px]">Policy ID</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Crop</TableHead>
                <TableHead>Pavilion AI</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow 
                  key={policy.id} 
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                  onClick={() => handleViewDetails(policy)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {policy.id.slice(0, 8)}...{policy.id.slice(-4)}
                  </TableCell>
                  <TableCell className="font-medium text-[#1B3A2B]">
                    {policy.region}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                      {getCropFromDetails(policy.premiumDetails)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {policy.agentReview ? (
                      <Badge
                        variant="secondary"
                        className={
                          policy.agentReview.recommendation === 'APPROVE'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : policy.agentReview.recommendation === 'DENY'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        }
                      >
                        {policy.agentReview.recommendation === 'APPROVE' ? '✓ Approve' :
                         policy.agentReview.recommendation === 'DENY' ? '✗ Deny' :
                         '? Review'}
                        {policy.agentReview.risk_level ? ` (${policy.agentReview.risk_level})` : ''}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Pending…</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(policy.coverageAmount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(policy.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApprove(policy.id)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDenyClick(policy.id)}
                        disabled={isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Deny
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-muted-foreground">
          {policies.length} pending {policies.length === 1 ? 'application' : 'applications'}
        </div>
      </Card>

      {/* Policy Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPolicy && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold text-[#1B3A2B] flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Policy Application
                    </DialogTitle>
                    <DialogDescription className="font-mono text-sm mt-1">
                      {selectedPolicy.id}
                    </DialogDescription>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending Review
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Farmer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Farmer Email</span>
                    </div>
                    <p className="font-medium text-[#1B3A2B]">
                      {selectedPolicy.user.email || 'Not provided'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      <span>Wallet Address</span>
                    </div>
                    <p className="font-mono text-sm truncate">
                      {selectedPolicy.user.walletAddress || 'Not linked'}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Location & Crop */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>Region</span>
                    </div>
                    <p className="font-medium text-[#1B3A2B]">{selectedPolicy.region}</p>
                    {selectedPolicy.coordinates && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedPolicy.coordinates.lat.toFixed(4)}, {selectedPolicy.coordinates.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wheat className="h-4 w-4" />
                      <span>Crop Type</span>
                    </div>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {getCropFromDetails(selectedPolicy.premiumDetails)}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Coverage & Premium */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                      <Shield className="h-4 w-4" />
                      <span>Coverage Amount</span>
                    </div>
                    <p className="font-bold text-lg text-green-800">
                      {formatCurrency(selectedPolicy.coverageAmount)}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-blue-700 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Premium Paid</span>
                    </div>
                    <p className="font-bold text-lg text-blue-800">
                      {selectedPolicy.premiumAmount ? formatCurrency(selectedPolicy.premiumAmount) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Weather Threshold */}
                {selectedPolicy.thresholdRainfall && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm text-[#1B3A2B] mb-2">Weather Trigger</h4>
                    <p className="text-sm text-muted-foreground">
                      Payout triggers when rainfall is below <strong>{selectedPolicy.thresholdRainfall}mm</strong>
                    </p>
                  </div>
                )}

                {/* Pavilion AI Agent Review */}
                {selectedPolicy.agentReview ? (
                  <div className={`rounded-lg p-4 border ${
                    selectedPolicy.agentReview.recommendation === 'APPROVE'
                      ? 'bg-green-50 border-green-200'
                      : selectedPolicy.agentReview.recommendation === 'DENY'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-[#1B3A2B] flex items-center gap-2">
                        🤖 Pavilion AI Recommendation
                      </h4>
                      <Badge
                        variant="secondary"
                        className={
                          selectedPolicy.agentReview.recommendation === 'APPROVE'
                            ? 'bg-green-100 text-green-700'
                            : selectedPolicy.agentReview.recommendation === 'DENY'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }
                      >
                        {selectedPolicy.agentReview.recommendation}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {selectedPolicy.agentReview.risk_score != null && (
                        <div className="text-center bg-white/60 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">Risk Score</p>
                          <p className="font-bold text-sm">{(selectedPolicy.agentReview.risk_score * 100).toFixed(0)}%</p>
                        </div>
                      )}
                      {selectedPolicy.agentReview.risk_level && (
                        <div className="text-center bg-white/60 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">Risk Level</p>
                          <p className="font-bold text-sm">{selectedPolicy.agentReview.risk_level}</p>
                        </div>
                      )}
                      {selectedPolicy.agentReview.premium_xrp != null && (
                        <div className="text-center bg-white/60 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">Agent Premium</p>
                          <p className="font-bold text-sm">{selectedPolicy.agentReview.premium_xrp} XRP</p>
                        </div>
                      )}
                    </div>

                    {/* Reasoning Steps */}
                    {selectedPolicy.agentReview.reasoning_log?.[0] && (() => {
                      const entry = selectedPolicy.agentReview!.reasoning_log![0] as { steps?: string[]; decision?: string }
                      return (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Agent Reasoning</p>
                          {entry.steps?.map((s: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                              <span className="text-primary mt-0.5">•</span> {s}
                            </p>
                          ))}
                          {entry.decision && (
                            <p className="text-xs font-medium mt-1">
                              Decision: {entry.decision}
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {selectedPolicy.agentReview.reviewedAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Reviewed {formatDate(selectedPolicy.agentReview.reviewedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Pavilion AI is reviewing this application…</span>
                    </div>
                  </div>
                )}

                {/* Submission Time */}
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Submitted</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedPolicy.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleDenyClick(selectedPolicy.id)}
                  disabled={isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny Application
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(selectedPolicy.id)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Approve Policy
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Deny Confirmation Dialog */}
      <AlertDialog open={isDenyDialogOpen} onOpenChange={setIsDenyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Deny Policy Application?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will reject the farmer's insurance application. 
              The policy will be marked as denied and the farmer will not receive coverage.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDenyConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Deny Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
