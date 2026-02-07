import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, ShieldCheck, AlertTriangle, TrendingUp, ClipboardCheck, RefreshCw, type LucideIcon } from "lucide-react"

import { getInsurerStats } from "@/app/insurer/actions"
import { RiskMap } from "@/components/dashboard/risk-map"

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
             href="/insurer/policies"
         />
         <KPICard 
             label="Active Policies" 
             value={stats.activePoliciesCount.toLocaleString()} 
             subValue={`${stats.pendingPoliciesCount} pending approval`}
             icon={ShieldCheck}
             href="/insurer/policies"
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
             label="Oracle Health" 
             value={`${stats.oracleHealth}%`} 
             subValue="All signers active" 
             icon={Activity}
             trend="stable"
             href="/insurer/oracle-simulator"
         />
         <KPICard 
             label="Projected Payouts" 
             value={payoutsFormatted} 
             subValue="Low risk forecast" 
             icon={AlertTriangle}
             alert={false}
             href="/insurer/approvals"
         />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
         
         {/* Risk Heatmap (2/3) */}
         <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-gray-100 bg-white z-10">
               <div className="flex justify-between items-center">
                  <div>
                     <CardTitle className="text-lg font-bold text-[#1B3A2B]">Risk Exposure Heatmap</CardTitle>
                     <CardDescription>Geographic distribution of insured value vs weather risk.</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-gray-200 text-gray-500">Global View</Badge>
               </div>
            </CardHeader>
            <div className="flex-1 bg-slate-50 relative min-h-[400px]">
               <RiskMap policies={stats.recentPolicies} />
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
   href?: string
}

function KPICard({ label, value, subValue, icon: Icon, trend, alert, href }: KPICardProps) {
   const CardContentWrapper = (
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
   )

   if (href) {
      return (
         <Link href={href}>
            <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer h-full">
               {CardContentWrapper}
            </Card>
         </Link>
      )
   }

   return (
      <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200 h-full">
         {CardContentWrapper}
      </Card>
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
