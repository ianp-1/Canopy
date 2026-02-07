import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InsurerStats } from '@/app/dashboard/insurer-actions'
import { Coins, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react'

export function LiquidityPoolCard({ stats }: { stats: InsurerStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
          <Coins className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLiquidity.toLocaleString()} RLUSD</div>
          <p className="text-xs text-muted-foreground">Available liquidity for claims</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Risk Exposure</CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalRiskExposure.toLocaleString()} RLUSD</div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            <div className="w-full bg-secondary h-1.5 rounded-full mr-2 overflow-hidden">
               <div 
                 className={`h-full rounded-full ${stats.utilizationRate > 80 ? 'bg-red-500' : stats.utilizationRate > 50 ? 'bg-amber-500' : 'bg-green-500'}`} 
                 style={{ width: `${Math.min(stats.utilizationRate, 100)}%` }} 
               />
            </div>
            {stats.utilizationRate.toFixed(1)}% Utilization
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
          <ShieldCheck className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activePolicies}</div>
          <p className="text-xs text-muted-foreground">+2 from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingPolicies}</div>
          <p className="text-xs text-muted-foreground">Requires immediate attention</p>
        </CardContent>
      </Card>
    </div>
  )
}
