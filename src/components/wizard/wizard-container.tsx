"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ArrowRight, ArrowLeft, Check, MapPin, Sprout, Umbrella } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"

const FarmFieldMap = dynamic(
   () => import('@/components/farm-map').then((mod) => mod.FarmFieldMap),
   {
      loading: () => <div className="w-full h-[400px] bg-muted/10 animate-pulse rounded-xl flex items-center justify-center text-muted-foreground">Loading Map...</div>,
      ssr: false
   }
)
import { PaymentModal } from "@/components/wizard/PaymentModal"
import type { FieldData } from "@/types/geo"
import { createPaymentRequest, activatePolicy, createNFTAcceptRequest, checkNFTAcceptStatus } from "@/app/actions/payment"
import { useAuth } from "@/components/auth/auth-provider"
import { getUserWallet } from "@/app/actions/auth"

const crops = [
   { id: "corn", name: "Corn", icon: "🌽", baseRate: 100 },
   { id: "soy", name: "Soy", icon: "🌱", baseRate: 120 },
   { id: "wheat", name: "Wheat", icon: "🌾", baseRate: 90 },
]

const ACTIVATION_STEPS = [
   "Verifying payment...",
   "Creating coverage escrow...",
   "Minting policy NFT...",
   "Finalizing policy...",
]

export function WizardContainer() {
   const [step, setStep] = useState(1)
   const [fieldData, setFieldData] = useState<FieldData | null>(null)
   const [selectedCrop, setSelectedCrop] = useState<string | null>(null)
   const [riskLevel, setRiskLevel] = useState([50])
   const [isProcessing, setIsProcessing] = useState(false)
   const [isComplete, setIsComplete] = useState(false)

   // Payment modal state
   const [showPaymentModal, setShowPaymentModal] = useState(false)
   const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null)
   const [paymentId, setPaymentId] = useState<string | null>(null)
   const [paymentDeepLink, setPaymentDeepLink] = useState<string | null>(null)
   const [txHash, setTxHash] = useState<string | null>(null)
   const [error, setError] = useState<string | null>(null)

   // Calculations
   const basePrice = selectedCrop ? crops.find(c => c.id === selectedCrop)?.baseRate || 100 : 0
   const riskMultiplier = (riskLevel[0] / 50)
   const estimatedPremium = Math.round(basePrice * riskMultiplier)
   const coverageAmount = 50000 // Fixed for demo

   const nextStep = () => setStep(s => Math.min(s + 1, 4))
   const prevStep = () => setStep(s => Math.max(s - 1, 1))

   const handleFieldChange = (field: FieldData | null) => {
      setFieldData(field)
   }

   const { user } = useAuth() // Need user for validation

   const handleProtect = async () => {
      setIsProcessing(true)
      setError(null)

      // 1. Validation Checks
      if (!user) {
         setError("You must be logged in to continue.")
         setIsProcessing(false)
         return
      }

      const hasWallet = user.user_metadata?.wallet_address || await getUserWallet() // Check context or fetch
      const hasEmail = user.email

      if (!hasWallet) {
         setError("Please connect your XRPL wallet in Settings to proceed.")
         setIsProcessing(false)
         return
      }

      // If logged in via wallet-only (no email), require email link? 
      // User requirement: "users who sign up with wallet should have to connect google or an email to also pay"
      if (!hasEmail && !user.user_metadata?.email) {
         setError("Please link an email address in Settings to proceed.")
         setIsProcessing(false)
         return
      }

      try {
         // Create payment request via Server Action
         const result = await createPaymentRequest(estimatedPremium, {
            crop: selectedCrop!,
            riskLevel: riskLevel[0],
            areaHectares: fieldData?.areaHectares,
         })

         if (result.success && result.qrUrl && result.payloadId) {
            setPaymentQrUrl(result.qrUrl)
            setPaymentId(result.payloadId)
            setPaymentDeepLink(result.deepLink || null)
            setShowPaymentModal(true)
            setError(null)
         } else {
            console.error('Payment creation failed:', result.error)
            setError(result.error || 'Failed to create payment request')
         }
      } catch (error) {
         console.error('Payment error:', error)
         setError('An unexpected error occurred')
      } finally {
         setIsProcessing(false)
      }
   }

   // State for XRPL data
   const [escrowData, setEscrowData] = useState<{
      sequence: number;
      txHash: string;
      explorerUrl: string;
   } | null>(null)
   const [nftData, setNftData] = useState<{
      tokenId: string;
      explorerUrl: string;
      offerId?: string;
   } | null>(null)
   // NFT acceptance state
   const [nftAcceptQrUrl, setNftAcceptQrUrl] = useState<string | null>(null)
   const [nftAcceptPayloadId, setNftAcceptPayloadId] = useState<string | null>(null)
   const [isNftAccepted, setIsNftAccepted] = useState(false)
   const [isActivating, setIsActivating] = useState(false)
   const [activationStepIndex, setActivationStepIndex] = useState(0)

   // Use effect to cycle through activation steps
   useEffect(() => {
      if (!isActivating) {
         setActivationStepIndex(0)
         return
      }

      const interval = setInterval(() => {
         setActivationStepIndex(prev => {
            if (prev < ACTIVATION_STEPS.length - 1) {
               return prev + 1
            }
            return prev
         })
      }, 2500) // Change step every 2.5 seconds

      return () => clearInterval(interval)
   }, [isActivating])

   const handlePaymentSuccess = async (result: { txHash: string; account: string }) => {
      setTxHash(result.txHash)
      setShowPaymentModal(false)
      setIsActivating(true)
      setActivationStepIndex(0)

      // Activate policy on XRPL (escrow + NFT) via Server Action
      try {
         const data = await activatePolicy({
            premiumAmount: estimatedPremium,
            crop: selectedCrop!,
            riskLevel: riskLevel[0],
            coordinates: fieldData?.geometry?.coordinates?.[0]?.[0]
               ? { lat: fieldData.geometry.coordinates[0][0][1], lng: fieldData.geometry.coordinates[0][0][0] }
               : undefined,
            geometry: fieldData?.geometry as any,
            areaHectares: fieldData?.areaHectares,
            premiumTxHash: result.txHash,
         })

         if (data.success && data.policyId) {
            console.log('Policy activated:', data.policyId)
            setEscrowData(data.escrow!)
            setNftData(data.nft!)
            // Keep activating state true while we prepare the NFT acceptance
            // setIsActivating(false) REMOVED: Wait until next step

            // Now prompt user to accept the NFT
            if (data.nft?.offerId) {
               console.log('Creating NFT accept request for offer:', data.nft.offerId)
               const acceptResult = await createNFTAcceptRequest(data.nft.offerId)

               if (acceptResult.success && acceptResult.qrUrl && acceptResult.payloadId) {
                  setNftAcceptQrUrl(acceptResult.qrUrl)
                  setNftAcceptPayloadId(acceptResult.payloadId)
                  // Now we can switch off activating state, as we have the QR code to show
                  setIsActivating(false)
                  // Don't set isComplete yet - wait for NFT acceptance
               } else {
                  console.error('Failed to create NFT accept request:', acceptResult.error)
                  // Failed to get QR, so stop activating and show completion without NFT
                  setIsActivating(false)
                  setIsComplete(true)
               }
            } else {
               console.error('No offer ID returned from activation')
               setIsActivating(false)
               setIsComplete(true)
            }
         } else {
            console.error('Activation failed:', data.error)
            setError(`Activation failed: ${data.error}`)
            setIsActivating(false)
            setIsComplete(true)
         }
      } catch (error) {
         console.error('Failed to activate policy:', error)
         setError('Failed to activate policy. Please contact support.')
         setIsActivating(false)
         setIsComplete(true)
      }
   }

   // Poll for NFT acceptance status
   useEffect(() => {
      if (!nftAcceptPayloadId) return

      const checkAcceptance = async () => {
         const status = await checkNFTAcceptStatus(nftAcceptPayloadId)

         if (status.signed) {
            console.log('NFT accepted! TX:', status.txHash)
            setIsNftAccepted(true)
            setNftAcceptQrUrl(null)
            setNftAcceptPayloadId(null)
            setIsComplete(true)
         } else if (status.rejected) {
            console.log('User rejected NFT acceptance')
            setNftAcceptQrUrl(null)
            setNftAcceptPayloadId(null)
            // Still show completion without NFT acceptance
            setIsComplete(true)
         }
      }

      const interval = setInterval(checkAcceptance, 2000)
      checkAcceptance() // Check immediately

      return () => clearInterval(interval)
   }, [nftAcceptPayloadId])

   const handlePaymentError = (error: string) => {
      console.error('Payment failed:', error)
      setShowPaymentModal(false)
      setError(`Payment failed: ${error}`)
   }

   return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground">

         {/* Left Panel - Sticky Summary */}
         <div className="w-full lg:w-[35%] lg:h-screen lg:sticky lg:top-0 bg-white border-b lg:border-b-0 lg:border-r border-border/50 p-6 md:p-12 flex flex-col justify-between z-10 shadow-sm lg:shadow-none">
            <div>
               <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
               </Link>
               <div className="flex items-center space-x-2 mb-8">
                  <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                     <span className="text-white font-bold text-lg">C</span>
                  </div>
                  <span className="text-xl font-bold tracking-tight">Canopy</span>
               </div>

               <div className="space-y-2 mb-12">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Quote</h2>
                  <div className="flex items-baseline gap-2">
                     <span className="text-6xl font-bold font-mono text-primary transition-all duration-300">
                        {selectedCrop ? estimatedPremium : "---"}
                     </span>
                     <span className="text-xl font-medium text-muted-foreground">XRP</span>
                  </div>
                  {selectedCrop && (
                     <Badge variant="secondary" className="mt-2 bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                        {riskLevel[0]}% Risk Coverage
                     </Badge>
                  )}
               </div>

               <div className="space-y-6">
                  <SummaryItem
                     icon={MapPin}
                     label="Location"
                     value={fieldData ? `${fieldData.areaHectares} ha (${fieldData.areaAcres} acres)` : "Draw Field"}
                     active={step === 1}
                  />
                  <SummaryItem icon={Sprout} label="Crop Type" value={crops.find(c => c.id === selectedCrop)?.name || "Select Crop"} active={step === 2} />
                  <SummaryItem icon={Umbrella} label="Coverage" value={selectedCrop ? `${coverageAmount.toLocaleString()} XRP` : "---"} active={step === 3} />
               </div>
            </div>

            <div className="hidden lg:block">
               <div className="bg-secondary/30 rounded-2xl p-6">
                  <h4 className="font-semibold mb-2 text-sm">Design Philosophy</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                     "Friendly Soft-Tech" ensures clarity at every step. We use live pricing to build trust.
                  </p>
               </div>
            </div>
         </div>

         {/* Right Panel - Steps */}
         <div className="flex-1 bg-background p-6 md:p-12 lg:p-24 flex flex-col justify-center min-h-[50vh]">
            {error && (
               <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl mb-6 flex flex-col gap-2 shadow-sm animate-in slide-in-from-top-2">
                  <div className="flex items-center">
                     <span className="font-medium mr-2">Action Required:</span> {error}
                     <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0 hover:bg-destructive/10" onClick={() => setError(null)}>
                        <span className="sr-only">Dismiss</span>
                        ✕
                     </Button>
                  </div>
                  {(error.includes("connect your XRPL wallet") || error.includes("link an email")) && (
                     <Link href="/account/settings?tab=wallet" className="w-fit">
                        <Button size="sm" variant="outline" className="bg-white border-destructive/20 text-destructive hover:bg-destructive/5">
                           Go to Settings
                        </Button>
                     </Link>
                  )}
               </div>
            )}

            {isComplete || isActivating || nftAcceptQrUrl ? (
               <div className="max-w-md mx-auto text-center space-y-6 animate-in fade-in zoom-in duration-500">
                  {isActivating ? (
                     <>
                        <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-6 shadow-lg shadow-blue-100 animate-pulse">
                           <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h2 className="text-3xl font-bold">Activating on XRPL...</h2>
                        <div className="space-y-2">
                           <p className="text-muted-foreground text-lg min-h-[1.75rem] transition-all duration-300">
                              {ACTIVATION_STEPS[activationStepIndex]}
                           </p>
                           <div className="flex justify-center gap-1 mt-2">
                              {ACTIVATION_STEPS.map((_, idx) => (
                                 <div
                                    key={idx}
                                    className={cn(
                                       "h-1.5 w-1.5 rounded-full transition-all duration-300",
                                       idx === activationStepIndex ? "bg-blue-600 w-4" : "bg-blue-200"
                                    )}
                                 />
                              ))}
                           </div>
                        </div>
                     </>
                  ) : nftAcceptQrUrl ? (
                     <>
                        <div className="h-20 w-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600 mb-4 shadow-lg shadow-purple-100">
                           <span className="text-3xl">🎁</span>
                        </div>
                        <h2 className="text-2xl font-bold">Claim Your Policy NFT</h2>
                        <p className="text-muted-foreground">
                           Scan with Xaman to receive your policy NFT certificate
                        </p>

                        <div className="bg-white p-4 rounded-2xl shadow-sm border inline-block">
                           {nftAcceptQrUrl && (
                              <Image
                                 src={nftAcceptQrUrl}
                                 alt="Scan to accept NFT"
                                 width={192}
                                 height={192}
                                 className="w-48 h-48 mx-auto"
                                 priority
                              />
                           )}
                        </div>

                        <p className="text-sm text-muted-foreground">
                           This will transfer the policy NFT to your wallet
                        </p>

                        <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => {
                              setNftAcceptQrUrl(null)
                              setNftAcceptPayloadId(null)
                              setIsComplete(true)
                           }}
                           className="text-muted-foreground"
                        >
                           Skip for now
                        </Button>
                     </>
                  ) : (
                     <>
                        <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-6 shadow-lg shadow-green-100">
                           <Check className="h-12 w-12" />
                        </div>
                        <h2 className="text-3xl font-bold">Policy Activated!</h2>
                        <p className="text-muted-foreground text-lg">
                           Your fields are now protected on the XRPL.
                           {isNftAccepted && " NFT claimed successfully! ✓"}
                        </p>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4 text-left">
                           {/* Premium Payment */}
                           <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Premium Paid</span>
                              <a
                                 href={`https://testnet.xrpl.org/transactions/${txHash}`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="font-mono text-xs text-primary hover:underline"
                              >
                                 {estimatedPremium} XRP
                              </a>
                           </div>

                           {/* Escrow Data */}
                           {escrowData && (
                              <>
                                 <div className="border-t pt-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Escrow (Phase 1)</p>
                                    <div className="flex justify-between text-sm">
                                       <span className="text-muted-foreground">Coverage Locked</span>
                                       <span className="font-mono text-xs">{(estimatedPremium * 20).toLocaleString()} XRP</span>
                                    </div>
                                    <div className="flex justify-between text-sm mt-2">
                                       <span className="text-muted-foreground">Escrow TX</span>
                                       <a
                                          href={escrowData.explorerUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-mono text-xs text-primary hover:underline"
                                       >
                                          {escrowData.txHash.slice(0, 8)}...{escrowData.txHash.slice(-6)}
                                       </a>
                                    </div>
                                 </div>
                              </>
                           )}

                           {/* NFT Data */}
                           {nftData && (
                              <>
                                 <div className="border-t pt-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Policy NFT (Phase 2)</p>
                                    <div className="flex justify-between text-sm">
                                       <span className="text-muted-foreground">Token ID</span>
                                       <span className="font-mono text-xs">
                                          {nftData.tokenId.slice(0, 10)}...
                                       </span>
                                    </div>
                                    <div className="flex justify-between text-sm mt-2">
                                       <span className="text-muted-foreground">Mint TX</span>
                                       <a
                                          href={nftData.explorerUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-mono text-xs text-primary hover:underline"
                                       >
                                          View on Explorer ↗
                                       </a>
                                    </div>
                                 </div>
                              </>
                           )}
                        </div>

                        <Link href="/dashboard">
                           <Button size="lg" className="w-full mt-4 h-12 shadow-lg shadow-primary/20">Go to Dashboard</Button>
                        </Link>
                     </>
                  )}
               </div>
            ) : (
               <div className="max-w-xl mx-auto w-full space-y-8">

                  {/* Progress */}
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex space-x-2">
                        {[1, 2, 3].map(i => (
                           <div key={i} className={cn("h-2 w-12 rounded-full transition-all duration-300", step >= i ? "bg-primary" : "bg-muted")} />
                        ))}
                     </div>
                     <span className="text-sm text-muted-foreground font-medium">Step {step} of 3</span>
                  </div>

                  {/* Step 1: Location */}
                  {step === 1 && (
                     <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
                        <h2 className="text-3xl font-bold">Where is your farm?</h2>
                        <p className="text-lg text-muted-foreground">Draw your field boundaries or import a file to calculate weather risk.</p>

                        <FarmFieldMap
                           onFieldChange={handleFieldChange}
                           className="aspect-video"
                        />

                        <p className="text-sm text-center text-muted-foreground">
                           Use the polygon tool to draw your field, or import a GeoJSON/Shapefile/KML
                        </p>
                     </div>
                  )}

                  {/* Step 2: Crop */}
                  {step === 2 && (
                     <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
                        <h2 className="text-3xl font-bold">What are you growing?</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           {crops.map(crop => (
                              <Card
                                 key={crop.id}
                                 onClick={() => setSelectedCrop(crop.id)}
                                 className={cn(
                                    "cursor-pointer transition-all duration-300 border-2 hover:scale-105",
                                    selectedCrop === crop.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-transparent shadow-sm hover:border-primary/20"
                                 )}
                              >
                                 <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                                    <div className="text-4xl">{crop.icon}</div>
                                    <span className="font-bold text-lg">{crop.name}</span>
                                 </CardContent>
                              </Card>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* Step 3: Risk */}
                  {step === 3 && (
                     <div className="space-y-8 animate-in slide-in-from-right-8 fade-in duration-300">
                        <h2 className="text-3xl font-bold">Customize Coverage</h2>

                        <div className="space-y-6 bg-white p-8 rounded-2xl border shadow-sm">
                           <div className="flex justify-between items-center">
                              <Label className="font-semibold text-base">Payout Threshold</Label>
                              <span className="font-mono bg-secondary/50 px-2 py-1 rounded-md text-sm">{riskLevel[0]}% Rainfall Deficit</span>
                           </div>
                           <Slider
                              value={riskLevel}
                              onValueChange={setRiskLevel}
                              max={90}
                              min={10}
                              step={5}
                              className="py-4"
                           />
                           <p className="text-sm text-muted-foreground">
                              Higher sensitivity increases your premium but triggers payouts sooner.
                           </p>
                        </div>

                        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 flex justify-between items-center">
                           <span className="font-medium text-primary">Total Premium</span>
                           <span className="text-2xl font-bold font-mono text-primary">{Math.round(basePrice * riskMultiplier)} XRP</span>
                        </div>
                     </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between pt-8">
                     {step > 1 && (
                        <Button variant="ghost" onClick={prevStep} size="lg" className="text-muted-foreground">
                           <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                     )}
                     <div className="ml-auto">
                        {step < 3 ? (
                           <Button
                              onClick={nextStep}
                              disabled={(step === 1 && !fieldData) || (step === 2 && !selectedCrop)}
                              size="lg"
                              className="bg-primary hover:bg-primary/90 rounded-full px-8 shadow-lg shadow-primary/20"
                           >
                              Continue <ArrowRight className="w-4 h-4 ml-2" />
                           </Button>
                        ) : (
                           <Button
                              onClick={handleProtect}
                              disabled={isProcessing}
                              size="lg"
                              className="bg-primary hover:bg-primary/90 rounded-full px-8 shadow-xl shadow-primary/20 min-w-[200px]"
                           >
                              {isProcessing ? "Processing..." : "Protect My Farm"}
                           </Button>
                        )}
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* Payment Modal */}
         <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            qrUrl={paymentQrUrl}
            payloadId={paymentId}
            deepLink={paymentDeepLink}
            amountXrp={estimatedPremium}
         />
      </div>
   )
}

function SummaryItem({ icon: Icon, label, value, active }: { icon: any, label: string, value: string, active: boolean }) {
   return (
      <div className={cn("flex items-center space-x-4 p-4 rounded-xl transition-all duration-300", active ? "bg-secondary/40 border border-secondary" : "opacity-60")}>
         <div className={cn("h-10 w-10 rounded-full flex items-center justify-center transition-colors", active ? "bg-white text-primary shadow-sm" : "bg-muted text-muted-foreground")}>
            <Icon className="h-5 w-5" />
         </div>
         <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="font-semibold text-foreground">{value}</p>
         </div>
      </div>
   )
}
