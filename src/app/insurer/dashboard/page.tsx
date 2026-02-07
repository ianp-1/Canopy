
import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, ShieldCheck, AlertTriangle, TrendingUp, ClipboardCheck, Map, RefreshCw, type LucideIcon } from "lucide-react"

import { getInsurerStats } from "@/app/insurer/actions"

export const metadata: Metadata = {
  title: 'Command Center',
}

export default async function InsurerDashboard() {
  const stats = await getInsurerStats()

  // Format TVL
  const tvlFormatted = stats.totalValueLocked > 1000000 
    ? `${(stats.totalValueLocked / 1000000).toFixed(1)}M XRP`
    : `${(stats.totalValueLocked / 1000).toFixed(1)}k XRP`

  // Format Payouts
  const payoutsFormatted = stats.projectedPayouts > 1000
    ? `${(stats.projectedPayouts / 1000).toFixed(1)}k XRP`
    : `${stats.projectedPayouts.toFixed(0)} XRP`

  // Combine logs and policies for activity feed
  const activityItems = [
    ...stats.recentPolicies.map(p => ({
      type: 'policy' as const,
      action: 'Policy Created',
      target: p.region,
      time: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date(p.createdAt).getTime()
    })),
    ...stats.oracleLogs.map(l => ({
      type: (l.errorMessage ? 'alert' : 'system') as 'alert' | 'system',
      action: l.action.replace('_', ' '),
      target: l.policy.region,
      time: new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date(l.createdAt).getTime()
    }))
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 7)

  return (
    <div className="p-8 space-y-8 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-bold text-[#1B3A2B] tracking-tight">Command Center</h1>
            <p className="text-muted-foreground mt-1">Global risk overview and liquidity management.</p>
         </div>
         <Button variant="outline" className="bg-white border-none shadow-sm text-muted-foreground hover:text-[#2E7D32]">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
         </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <KPICard 
             label="Total Value Locked" 
             value={tvlFormatted} 
             subValue="+12% this month" 
             icon={TrendingUp}
             trend="up"
         />
         <KPICard 
             label="Active Policies" 
             value={stats.activePoliciesCount.toLocaleString()} 
             subValue={`${stats.pendingPoliciesCount} pending approval`}
             icon={ShieldCheck}
         />
         <Link href="/insurer/approvals" className="block">
           <KPICard 
               label="Pending Approvals" 
               value={stats.pendingPoliciesCount.toLocaleString()} 
               subValue="Click to review"
               icon={ClipboardCheck}
               alert={stats.pendingPoliciesCount > 0}
           />
         </Link>
         <KPICard 
             label="Projected Payouts" 
             value={payoutsFormatted} 
             subValue="Low risk forecast" 
             icon={AlertTriangle}
             alert={false}
         />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
         
         {/* Risk Heatmap (2/3) */}
         <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden flex flex-col">
            <CardHeader className="border-b border-gray-100 bg-white z-10">
               <div className="flex justify-between items-center">
                  <div>
                     <CardTitle className="text-lg font-bold text-[#1B3A2B]">Risk Exposure Heatmap</CardTitle>
                     <CardDescription>Geographic distribution of insured value vs weather risk.</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-gray-200 text-gray-500">Global View</Badge>
               </div>
            </CardHeader>
            <div className="flex-1 bg-slate-50 relative group cursor-crosshair">
               {/* Mock Map Background */}
               <div className="absolute inset-0 bg-[#E3F2FD] opacity-50" />
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#1B3A2B 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
               
               {/* Heatmap Blobs */}
               <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-400/30 rounded-full blur-3xl" />
               <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-green-500/20 rounded-full blur-3xl" />
               <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-red-400/30 rounded-full blur-2xl animate-pulse" /> {/* High risk zone */}

               {/* Dynamic Markers from DB */}
               {stats.recentPolicies.slice(0, 5).map((policy, i) => {
                  // Mock positioning if no coords (random scattering for demo)
                  const top = policy.coordinates ? '50%' : `${30 + (i * 10)}%` 
                  const left = policy.coordinates ? '50%' : `${20 + (i * 15)}%`
                  
                  return (
                    <MapMarker 
                       key={policy.id}
                       top={top} 
                       left={left} 
                       size="md" 
                       label={policy.region} 
                    />
                  )
               })}
               
               {/* Static Legend */}
               <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-white/50 text-xs">
                  <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-green-500 rounded-full"/> Low Risk</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"/> High Probability</div>
               </div>
            </div>
         </Card>

         {/* Activity Feed (1/3) */}
         <Card className="border-none shadow-sm bg-white flex flex-col">
            <CardHeader className="border-b border-gray-100">
               <CardTitle className="text-lg font-bold text-[#1B3A2B]">Recent Activity</CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-0">
               <div className="divide-y divide-gray-50">
                  {activityItems.length > 0 ? activityItems.map((item, i) => (
                    <ActivityItem 
                       key={i} 
                       action={item.action} 
                       target={item.target} 
                       time={item.time} 
                       type={item.type} 
                    />
                  )) : (
                     <p className="p-4 text-sm text-muted-foreground text-center">No recent activity</p>
                  )}
               </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
               <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-[#2E7D32]">View All Logs</Button>
            </div>
         </Card>
      </div>
    </div>
  )
}


interface KPICardProps {
   label: string
   value: string
   subValue: string
   icon: LucideIcon
   trend?: 'up' | 'down' | 'stable'
   alert?: boolean
}

function KPICard({ label, value, subValue, icon: Icon, trend, alert }: KPICardProps) {
   return (
      <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
         <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
               <div className={`p-2 rounded-xl ${alert ? 'bg-red-50 text-red-600' : 'bg-[#E8F5E9] text-[#2E7D32]'}`}>
                  <Icon className="h-5 w-5" />
               </div>
               {trend && <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Active</Badge>}
            </div>
            <div>
               <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
               <h3 className="text-2xl font-bold font-mono text-[#1B3A2B] mt-1">{value}</h3>
               <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {subValue}
               </p>
            </div>
         </CardContent>
      </Card>
   )
}

interface MapMarkerProps {
   top: string
   left: string
   size: 'sm' | 'md' | 'lg'
   color?: string
   label: string
}

function MapMarker({ top, left, size, color = "bg-[#2E7D32]", label }: MapMarkerProps) {
   const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
   
   return (
      <div className="absolute transform -translate-x-1/2 -translate-y-1/2 group" style={{ top, left }}>
         <div className={`rounded-full ${color} ${sizeClass} shadow-lg ring-4 ring-white/30 animate-pulse`} />
         <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#1B3A2B] text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
            {label}
         </div>
      </div>
   )
}

interface ActivityItemProps {
   action: string
   target: string
   time: string
   type?: 'normal' | 'alert' | 'system' | 'policy'
}

function ActivityItem({ action, target, time, type = "normal" }: ActivityItemProps) {
   return (
      <div className="p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
         <div className={`w-2 h-2 rounded-full ${type === 'alert' ? 'bg-red-500' : type === 'system' ? 'bg-blue-400' : 'bg-[#2E7D32]'}`} />
         <div className="flex-1">
            <p className="text-sm font-semibold text-[#1B3A2B]">{action}</p>
            <p className="text-xs text-muted-foreground">{target}</p>
         </div>
         <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 px-2 py-1 rounded-full">{time}</span>
      </div>
   )
}
