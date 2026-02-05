"use client"

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/landing-nav";
import { Player } from "@remotion/player";
import { ShowcaseVideo } from "@/remotion/ShowcaseVideo";
import { AnimatedIcon } from "@/remotion/AnimatedIcons";
import { CloudRain } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-background text-foreground">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Canopy</span>
          <Badge variant="secondary" className="ml-2 hidden sm:inline-flex bg-accent text-accent-foreground">Beta</Badge>
        </div>
        <div className="hidden md:flex">
           <LandingNav />
        </div>
        <div className="flex space-x-4">
          <Link href="/dashboard">
             <Button variant="ghost" className="text-foreground">Log In</Button>
          </Link>
          <Link href="/wizard">
            <Button className="font-semibold shadow-lg shadow-primary/20">
              Get Protected
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow container mx-auto px-6 pt-12 pb-24 md:pt-24 md:pb-32 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 space-y-8 text-center md:text-left">
          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
            Trusted by 5,000+ Farmers
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
            Crop Insurance <br />
            <span className="text-primary">Made Simple.</span>
          </h1>
          <p className="text-xl text-muted-foreground md:pr-12 leading-relaxed">
            Instant, data-driven protection for your farm. No paperwork, just transparent coverage powered by the XRP Ledger.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
            <Link href="/wizard">
              <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-primary/20 border-2 border-transparent">
                Start Quote
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-2">
              View Documentation
            </Button>
          </div>
          
          <div className="pt-8 flex items-center justify-center md:justify-start space-x-8 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Instant Payouts</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span>Weather Oracle</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span>XRPL Secured</span>
            </div>
          </div>
        </div>

        <div className="md:w-1/2 mt-16 md:mt-0 relative">
          <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 border-4 border-white/50 bg-white aspect-square md:aspect-[4/3]">
             <Image 
                src="/hero_farmer.jpg" 
                alt="Farmer checking crops" 
                fill 
                className="object-cover"
                priority
             />
             {/* Green Tint Overlay */}
             <div className="absolute inset-0 bg-[#1B3A2B]/20 mix-blend-multiply" />
             
             {/* Notification Card Overlay (Compact) */}
             <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80">
                <div className="bg-[#F0FDF4]/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Live Monitoring</span>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                         Active
                      </div>
                   </div>
                   <div className="flex items-start space-x-3">
                      <div className="bg-blue-100 p-2 rounded-full text-blue-500 shrink-0">
                         <CloudRain size={20} />
                      </div>
                      <div>
                         <h3 className="font-bold text-sm text-[#0F172A]">Rainfall Deficit</h3>
                         <p className="text-muted-foreground text-xs mt-0.5 leading-snug">Threshold reached in Zone 4B.</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          {/* Decorative blobs */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-secondary rounded-full blur-3xl -z-10" />
        </div>
      </main>

      {/* Simulation Section (Floating Card Style for Subtle Transition) */}
      <section className="py-12 md:py-24">
          <div className="container mx-auto px-6">
              <div className="bg-[#1B3A2B] rounded-[3rem] p-8 md:p-16 text-white overflow-hidden relative shadow-2xl">
                  {/* Background texture */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                      <div className="md:w-1/2 space-y-6">
                          <Badge className="bg-white/10 text-white border-none hover:bg-white/20">Preview</Badge>
                          <h2 className="text-3xl md:text-5xl font-bold leading-tight">Experience Phase-By-Phase Protection.</h2>
                          <p className="text-white/60 text-lg leading-relaxed">
                              Watch how Canopy guides you from field selection to active coverage in seconds. Our wizard handles the complexity of blockchain and oracle integration behind the scenes.
                          </p>
                          <ul className="space-y-4 pt-4 text-white/80">
                              <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]" /> Real-time risk assessment</li>
                              <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]" /> Instant premium calculation</li>
                              <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]" /> One-click policies</li>
                          </ul>
                      </div>
                      <div className="md:w-1/2 w-full">
                          <div className="rounded-3xl overflow-hidden shadow-2xl aspect-video">
                             <Player
                                component={ShowcaseVideo}
                                durationInFrames={150}
                                compositionWidth={800}
                                compositionHeight={600}
                                fps={30}
                                style={{
                                   width: '100%',
                                   height: '100%',
                                }}
                                controls={false}
                                autoPlay
                                loop
                                acknowledgeRemotionLicense
                             />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-white">
         <div className="container mx-auto px-6">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-bold mb-4">Protection in 3 Steps</h2>
               <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Our automated wizard guides you through the process in less than 2 minutes.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-12 relative">
               {/* Connecting Line (Desktop) */}
               <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-gray-200 to-transparent z-0" />
               
               <StepCard 
                  number={1}
                  title="Map Your Field" 
                  description="Locate your farm using satellite imagery to establish coverage boundaries." 
               />
               <StepCard 
                  number={2}
                  title="Customize Risk" 
                  description="Choose your payout triggers based on rainfall or drought thresholds." 
               />
               <StepCard 
                  number={3}
                  title="Instant Activation" 
                  description="Policy is minted as an NFT on the XRP Ledger. Protection starts immediately." 
               />
            </div>
         </div>
      </section>

      {/* Feature Grid with Remotion Icons */}
      <section className="bg-secondary/20 py-24">
         <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
               <h2 className="text-3xl font-bold mb-4">Why Farmers Choose Canopy</h2>
               <p className="text-muted-foreground text-lg">We use satellite data and smart contracts to verify claims instantly.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
               <FeatureCard 
                  iconType="lightning" 
                  title="Flash Payouts" 
                  description="No claims adjuster needed. When the weather hits the trigger, you get paid automatically." 
                  color="bg-yellow-50/50 hover:bg-yellow-50"
               />
               <FeatureCard 
                  iconType="satellite" 
                  title="Satellite Oracle" 
                  description="Precision monitoring using NOAA weather stations and satellite imagery vs your field location." 
                  color="bg-blue-50/50 hover:bg-blue-50"
               />
               <FeatureCard 
                  iconType="secure" 
                  title="Ledger Secured" 
                  description="Built on the XRP Ledger (XRPL) for transparent, low-fee, and immutable contract storage." 
                  color="bg-green-50/50 hover:bg-green-50"
               />
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1B3A2B] text-white py-12">
         <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
               <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                  <span className="text-white font-bold text-lg">C</span>
               </div>
               <span className="text-xl font-bold tracking-tight">Canopy</span>
            </div>
            <div className="flex space-x-8 text-white/60 text-sm">
               <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
               <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
               <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
            <div className="mt-4 md:mt-0 text-white/40 text-xs">
               © 2024 Canopy Insurance. Built on XRPL.
            </div>
         </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number, title: string, description: string }) {
   return (
      <div className="relative z-10 flex flex-col items-center text-center">
         <div className="w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6 border border-gray-100">
            <span className="text-4xl font-bold text-[#1B3A2B]">{number}</span>
         </div>
         <h3 className="text-xl font-bold mb-2 text-[#1B3A2B]">{title}</h3>
         <p className="text-muted-foreground">{description}</p>
      </div>
   )
}

function FeatureCard({ iconType, title, description, color }: { iconType: "lightning" | "satellite" | "secure", title: string, description: string, color: string }) {
   return (
      <Card className={`border-none shadow-none transition-colors duration-300 ${color}`}>
         <CardContent className="pt-8 pb-8 px-8 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center shadow-sm overflow-hidden border border-white/50">
               <Player
                  component={AnimatedIcon}
                  inputProps={{ type: iconType }}
                  durationInFrames={120}
                  compositionWidth={64}
                  compositionHeight={64}
                  fps={30}
                  style={{ width: 64, height: 64 }}
                  controls={false}
                  autoPlay
                  loop
                  acknowledgeRemotionLicense
               />
            </div>
            <h3 className="text-xl font-bold text-[#1B3A2B]">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
         </CardContent>
      </Card>
   )
}
