import { WeatherWidget } from "@/components/dashboard/weather-widget"
import { PolicyCard } from "@/components/dashboard/policy-card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

import { getCurrentUser, getUserPolicies, getDashboardStats } from "./actions"

// Map crop to display info
const cropInfo: Record<string, { name: string; emoji: string }> = {
  corn: { name: 'Corn', emoji: '🌽' },
  soy: { name: 'Soy', emoji: '🌱' },
  wheat: { name: 'Wheat', emoji: '🌾' },
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  
  // --- Farmer Dashboard Logic ---
  // (INSURER users are redirected by layout.tsx)
  const policies = await getUserPolicies()
  const stats = await getDashboardStats()
  
  // Get display name from email or wallet
  const displayName = user?.email 
    ? user.email.split('@')[0] 
    : user?.walletAddress 
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Farmer'

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Good {getGreeting()}, {displayName}
          </h1>
          <p className="text-muted-foreground">
            {policies.length > 0 
              ? `You have ${policies.length} active ${policies.length === 1 ? 'policy' : 'policies'}.`
              : 'Get started by creating your first policy.'
            }
          </p>
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
         
         {/* Stats Card */}
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
                    className="h-full bg-white rounded-full transition-all duration-500" 
                    style={{ 
                      width: stats.riskLevel === 'High' ? '75%' 
                           : stats.riskLevel === 'Medium' ? '50%' 
                           : stats.riskLevel === 'Low' ? '25%' 
                           : '0%' 
                    }}
                  />
               </div>
               <p className="text-xs mt-2 opacity-70">{stats.activePolicies} Active Policies</p>
            </div>
         </div>
      </div>

      {/* Policies */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Active Policies</h2>
            {policies.length > 3 && (
              <Button variant="link" className="text-primary hover:no-underline hover:text-primary/80">
                View All
              </Button>
            )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {policies.map((policy: any) => {
            const crop = (policy.premiumDetails?.crop || 'wheat') as string
            const info = cropInfo[crop] || { name: crop, emoji: '🌾' }
            
            return (
              <PolicyCard 
                key={policy.id}
                id={policy.id}
                crop={info.name}
                cropEmoji={info.emoji}
                region={policy.region} 
                coverage={policy.coverageAmount.toLocaleString()}
                premium={policy.premiumAmount?.toLocaleString() || '0'}
                status={policy.status.toLowerCase() as 'active' | 'claimed' | 'expired'}
                createdAt={policy.createdAt}
              />
            )
          })}
          
          <Link href="/wizard" className="group">
            <div className="h-full min-h-[180px] rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-2 cursor-pointer">
               <div className="h-10 w-10 rounded-full bg-white border shadow-sm flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                  <Plus className="h-5 w-5" />
               </div>
               <p className="font-medium text-muted-foreground group-hover:text-primary">Add New Policy</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
