import { WeatherWidget } from "@/components/dashboard/weather-widget"
import { PolicyCard } from "@/components/dashboard/policy-card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Good morning, Farmer John</h1>
          <p className="text-muted-foreground">Your fields are looking healthy today.</p>
        </div>
        <Link href="/wizard">
           <Button className="shadow-lg shadow-primary/20">
             <Plus className="w-4 h-4 mr-2" /> New Policy
           </Button>
        </Link>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Weather takes up 2 cols on large screens if desired, or full width */}
         <div className="lg:col-span-2">
            <WeatherWidget />
         </div>
         
         {/* Quick status or mini widget could go here, or just empty for now */}
         <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white shadow-xl shadow-primary/20 flex flex-col justify-between">
            <div>
               <p className="text-primary-foreground/80 font-medium text-sm uppercase tracking-wider mb-1">Total Coverage</p>
               <h3 className="text-4xl font-bold font-mono">150,000 <span className="text-xl">XRP</span></h3>
            </div>
            <div className="mt-8">
               <div className="flex justify-between text-sm mb-2 opacity-90">
                  <span>Risk Level</span>
                  <span>Low</span>
               </div>
               <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-1/4 rounded-full" />
               </div>
            </div>
         </div>
      </div>

      {/* Policies */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Active Policies</h2>
            <Button variant="link" className="text-primary hover:no-underline hover:text-primary/80">View All</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <PolicyCard 
            id="1"
            crop="Corn"
            location="Iowa Field #4" 
            coverage="50,000"
            premium="150"
            status="active"
          />
           <PolicyCard 
            id="2"
            crop="Soy"
            location="North Field 2" 
            coverage="75,000"
            premium="210"
            status="active"
          />
           <Link href="/wizard" className="group">
             <div className="h-full min-h-[180px] rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-2 cursor-pointer">
                <div className="h-10 w-10 rounded-full bg-white border shadow-sm flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                   <Plus className="h-5 w-5" />
                </div>
                <p className="font-medium text-muted-foreground group-hover:text-primary">Add New Field</p>
             </div>
           </Link>
        </div>
      </div>
    </div>
  )
}
