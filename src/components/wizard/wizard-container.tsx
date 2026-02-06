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
import { createPolicy } from "@/actions/policy-actions"

const crops = [
  { id: "corn", name: "Corn", icon: "🌽", baseRate: 100 },
  { id: "soy", name: "Soy", icon: "🌱", baseRate: 120 },
  { id: "wheat", name: "Wheat", icon: "🌾", baseRate: 90 },
]

export function WizardContainer() {
  const [step, setStep] = useState(1)
  const [location, setLocation] = useState("")
  const [markupStep1, setMarkupStep1] = useState(false) // Fake location selection
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null)
  const [riskLevel, setRiskLevel] = useState([50])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // Calculations
  const basePrice = selectedCrop ? crops.find(c => c.id === selectedCrop)?.baseRate || 100 : 0
  const riskMultiplier = (riskLevel[0] / 50) 
  const estimatedPremium = Math.round(basePrice * riskMultiplier)
  const coverageAmount = 50000 // Fixed for demo

  const nextStep = () => setStep(s => Math.min(s + 1, 4))
  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  const handleLocationSelect = () => {
     setMarkupStep1(true)
     setLocation("Iowa Field #4")
     setTimeout(() => nextStep(), 800)
  }

  // Result State
  const [txHash, setTxHash] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")

  const handleProtect = async () => {
     setIsProcessing(true)
     setErrorMessage("")
     
     try {
        const result = await createPolicy({
           cropId: selectedCrop || "corn",
           locationName: location || "Unknown Region",
           coordinates: { lat: 41.8781, lng: -93.6091 }, // Mock coordinates for Iowa
           coverageAmount: coverageAmount,
           riskThreshold: riskLevel[0]
        })

        if (result.success && result.txHash) {
            setTxHash(result.txHash)
            setIsComplete(true)
        } else {
            setErrorMessage(typeof result.error === 'string' ? result.error : "Failed to create policy. Please check input.")
        }
     } catch (e) {
         setErrorMessage("Unexpected error occurred.")
         console.error(e)
     } finally {
         setIsProcessing(false)
     }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground">
      
      {/* Left Panel - Sticky Summary */}
      <div className="w-full lg:w-[35%] lg:h-screen lg:sticky lg:top-0 bg-white border-b lg:border-b-0 lg:border-r border-border/50 p-6 md:p-12 flex flex-col justify-between z-10 shadow-sm lg:shadow-none">
         <div>
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
               <SummaryItem icon={MapPin} label="Location" value={location || "Select Location"} active={step === 1} />
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
         
         {isComplete ? (
            <div className="max-w-md mx-auto text-center space-y-6 animate-in fade-in zoom-in duration-500">
               <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-6 shadow-lg shadow-green-100">
                  <Check className="h-12 w-12" />
               </div>
               <h2 className="text-3xl font-bold">Policy Activated!</h2>
               <p className="text-muted-foreground text-lg">Your fields are now protected on the XRPL.</p>
               <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                  <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Transaction Hash</span>
                     <span className="font-mono text-xs">{txHash}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Policy ID</span>
                     <span className="font-mono text-xs">#PENDING</span>
                  </div>
               </div>
               <Link href="/dashboard">
                  <Button size="lg" className="w-full mt-4 h-12 shadow-lg shadow-primary/20">Go to Dashboard</Button>
               </Link>
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
                     <p className="text-lg text-muted-foreground">Select your field boundaries to calculate weather risk.</p>
                     
                     <div 
                        onClick={handleLocationSelect}
                        className={cn(
                           "aspect-video bg-muted rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-300 border-2",
                           markupStep1 ? "border-primary ring-4 ring-primary/10" : "border-transparent hover:border-primary/50"
                        )}
                     >
                        {/* Fake Map */}
                        <div className="absolute inset-0 bg-[#e5e7eb] flex items-center justify-center">
                           <span className="text-muted-foreground font-medium">Interactive Map Placeholder</span>
                        </div>
                        <div className={cn("absolute inset-0 bg-primary/10 flex items-center justify-center transition-opacity duration-300", markupStep1 ? "opacity-100" : "opacity-0")}>
                           <MapPin className="h-12 w-12 text-primary animate-bounce" />
                        </div>
                     </div>
                     <p className="text-sm text-center text-muted-foreground">Click the map to simulate selection</p>
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
                           disabled={(step === 1 && !location) || (step === 2 && !selectedCrop)}
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
