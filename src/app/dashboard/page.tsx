import { WeatherWidget } from "@/components/dashboard/weather-widget"
import { PolicyCard } from "@/components/dashboard/policy-card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { getDashboardStats, getUserPolicies } from "@/actions/policy-actions"

// For Demo/Dev Phase: Hardcoded User ID matches the one in createPolicy
const DEMO_USER_ID = "mock-user-id";

export default async function DashboardPage() {
  // Fetch Data Parallelly
  const [stats, policiesResult] = await Promise.all([
      getDashboardStats(DEMO_USER_ID),
      getUserPolicies(DEMO_USER_ID)
  ]);

  const policies = policiesResult.success ? policiesResult.data : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Good morning, Farmer</h1>
          <p className="text-muted-foreground">Your fields are protected on the XRPL.</p>
        </div>
        <Link href="/wizard">
           <Button className="shadow-lg shadow-primary/20">
             <Plus className="w-4 h-4 mr-2" /> New Policy
           </Button>
        </Link>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Weather takes up 2 cols on large screens */}
         <div className="lg:col-span-2">
            <WeatherWidget />
         </div>
         
         {/* KPI Widget */}
         <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white shadow-xl shadow-primary/20 flex flex-col justify-between">
            <div>
               <p className="text-primary-foreground/80 font-medium text-sm uppercase tracking-wider mb-1">Total Coverage</p>
               <h3 className="text-4xl font-bold font-mono">
                  {stats.totalCoverage.toLocaleString()} <span className="text-xl">XRP</span>
               </h3>
            </div>
            <div className="mt-8">
               <div className="flex justify-between text-sm mb-2 opacity-90">
                  <span>Risk Level</span>
                  <span>{stats.riskLevel}</span>
               </div>
               <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-white rounded-full transition-all duration-500`}
                    style={{ width: stats.riskLevel === 'High' ? '80%' : stats.riskLevel === 'Medium' ? '50%' : '20%' }}
                  />
               </div>
               <p className="text-xs mt-2 opacity-70">{stats.activeCount} Active Policies</p>
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
          {policies?.map((policy: any) => {
             // Parse JSON fields safely
             const cropId = policy.weatherThumbnail?.cropId || 'corn';
             const cropName = cropId.charAt(0).toUpperCase() + cropId.slice(1);
             const premium = policy.premiumDetails?.total || 0;

             return (
                <PolicyCard 
                    key={policy.id}
                    id={policy.id}
                    crop={cropName}
                    location={policy.region}
                    coverage={policy.coverageAmount.toLocaleString()}
                    premium={premium.toString()}
                    status={policy.status.toLowerCase()}
                />
             )
          })}

           {/* Add New Card */}
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
