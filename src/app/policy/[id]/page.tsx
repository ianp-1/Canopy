import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Share2, Activity, CloudRain, Clock, AlertTriangle, CheckCircle2, TrendingUp, Copy, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function PolicyDetailsPage({ params }: { params: { id: string } }) {
  // Mock data - in real app would use params.id to fetch
  const policy = {
    id: "0008KV...289a",
    name: "Iowa Field #4",
    coverage: 50000,
    premium: 150,
    expiry: "2026-11-30",
    daysLeft: 84,
    probability: 12,
    threshold: 45 // mm rainfall
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans md:max-w-6xl mx-auto space-y-8">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
             <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
             </Link>
             <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{policy.name}</h1>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 h-7 text-sm">Active Protection</Badge>
             </div>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" className="bg-white border-border shadow-sm">
                <Share2 className="h-4 w-4 mr-2" /> Share Details
             </Button>
             <Button variant="outline" size="sm" className="bg-white border-border shadow-sm">
                <ExternalLink className="h-4 w-4 mr-2" /> View on Ledger
             </Button>
          </div>
       </div>

       {/* Key Metrics Grid */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
             label="Coverage Value"
             value={`${policy.coverage.toLocaleString()} XRP`}
             icon={CheckCircle2}
             trend="Secured"
             trendColor="text-green-600"
          />
          <MetricCard 
             label="Payout Probability"
             value={`${policy.probability}%`}
             valueSub="Risk Level"
             icon={Activity}
             trend="Low Risk"
             trendColor="text-green-600"
          />
          <MetricCard 
             label="Duration Left"
             value={`${policy.daysLeft} Days`}
             icon={Clock}
             trend="Expires Nov 30"
          />
           <MetricCard 
             label="Trigger Condition"
             value={`< ${policy.threshold}mm`}
             valueSub="Rainfall"
             icon={CloudRain}
             trend="Station 4829"
          />
       </div>

       {/* Main Content Split */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Analytics Cluster (66%) */}
          <div className="lg:col-span-2 space-y-6">
             <Card className="border-none shadow-sm h-full">
                <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" /> 
                      Moisture Variance Tracker
                   </CardTitle>
                   <CardDescription>Real-time telemetry from NOAA Station vs Policy Threshold</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="h-[300px] w-full bg-secondary/20 rounded-xl relative flex items-end p-6 border border-border/50 overflow-hidden">
                      {/* Fake Chart Lines */}
                      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/30 to-transparent" />
                      
                      {/* Grid Lines */}
                      <div className="absolute inset-0 w-full h-full p-6 flex flex-col justify-between pointer-events-none">
                         {[1,2,3,4,5].map(i => <div key={i} className="w-full h-px bg-border/40 dashed" />)}
                      </div>

                      {/* Threshold Line (Red) */}
                      <div className="absolute left-0 right-0 top-[60%] h-px bg-red-400 border-t-2 border-red-400 border-dashed z-20">
                         <span className="absolute -top-6 right-4 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">Trigger Limit (45mm)</span>
                      </div>

                      {/* Data Trend (Blue) - SVG Path */}
                      <svg className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="none">
                         <path 
                           d="M0,200 C150,180 300,240 450,210 C600,180 750,100 900,120" 
                           fill="none" 
                           stroke="#0ea5e9" 
                           strokeWidth="4" 
                           className="drop-shadow-lg"
                         />
                         <path 
                           d="M0,200 C150,180 300,240 450,210 C600,180 750,100 900,120 V300 H0 Z" 
                           fill="url(#gradient)" 
                           opacity="0.2"
                         />
                         <defs>
                           <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5"/>
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0"/>
                           </linearGradient>
                         </defs>
                         {/* Current Point */}
                         <circle cx="80%" cy="40%" r="6" fill="#0ea5e9" className="animate-pulse" />
                      </svg>
                   </div>
                   
                   <div className="flex justify-between mt-4 text-sm text-muted-foreground">
                      <span>30 Days Ago</span>
                      <span>Today</span>
                   </div>
                </CardContent>
             </Card>
          </div>

          {/* Right: Technical/Status (33%) */}
          <div className="space-y-6">
             {/* Oracle Status Gauge */}
             <Card className="border-none shadow-sm bg-background border border-border">
                <CardHeader>
                   <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Live Monitor</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center py-6">
                   <div className="relative h-40 w-40 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                         {/* Track */}
                         <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted/30" />
                         {/* Val */}
                         <circle 
                           cx="50%" 
                           cy="50%" 
                           r="45%" 
                           stroke="var(--color-primary)" 
                           strokeWidth="12" 
                           fill="transparent" 
                           strokeDasharray="283" 
                           strokeDashoffset="60" 
                           strokeLinecap="round"
                           className="drop-shadow-md transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-3xl font-bold font-mono">12<span className="text-sm text-muted-foreground">mm</span></span>
                         <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full mt-1">Safe Zone</span>
                      </div>
                   </div>
                   <div className="w-full mt-6 space-y-3">
                      <div className="flex justify-between text-sm">
                         <span className="text-muted-foreground">Next Update</span>
                         <span className="font-mono">14m 30s</span>
                      </div>
                      <div className="flex justify-between text-sm">
                         <span className="text-muted-foreground">Oracle Source</span>
                         <span className="font-mono text-primary truncate max-w-[120px]">NOAA-4829-X</span>
                      </div>
                   </div>
                </CardContent>
             </Card>

             {/* Contract DNA */}
             <Card className="border-none shadow-sm bg-secondary/10">
                <CardHeader>
                   <CardTitle className="text-sm font-semibold flex items-center">
                      <div className="h-2 w-2 rounded-full bg-purple-500 mr-2" />
                      Contract DNA
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <DNAItem label="Policy ID" value={policy.id} copyable />
                   <DNAItem label="Ledger Seq" value="#8829103" />
                   <DNAItem label="Condition Hash" value="cc:09...f4a" copyable />
                </CardContent>
             </Card>
          </div>
       </div>
    </div>
  )
}

function MetricCard({ label, value, valueSub, icon: Icon, trend, trendColor = "text-muted-foreground" }: any) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
         <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
         </div>
         <div>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-baseline gap-1">
               {value}
               {valueSub && <span className="text-xs text-muted-foreground font-sans font-normal ml-1">{valueSub}</span>}
            </div>
            {trend && <p className={`text-xs font-medium mt-1 ${trendColor}`}>{trend}</p>}
         </div>
      </CardContent>
    </Card>
  )
}

function DNAItem({ label, value, copyable }: { label: string, value: string, copyable?: boolean }) {
  return (
    <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-border/50">
       <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</span>
          <span className="text-xs font-mono font-medium truncate max-w-[120px] md:max-w-[180px]">{value}</span>
       </div>
       {copyable && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
             <Copy className="h-3 w-3" />
          </Button>
       )}
    </div>
  )
}
