'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LiquidityPoolCard } from "./liquidity-pool-card"
import { PolicyReviewTable } from "./policy-review-table"
import { RiskMap } from "./risk-map"
import { InsurerStats } from "@/app/dashboard/insurer-actions"

type InsurerViewProps = {
  stats: InsurerStats
  policies: any[]
}

export function InsurerView({ stats, policies }: InsurerViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Insurer Dashboard</h1>
        <div className="text-sm text-muted-foreground">
           Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <LiquidityPoolCard stats={stats} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk-map">Risk Map</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RiskMap policies={policies} />
            <div className="space-y-4">
               {/* Could add Recent Activity or Notifications here */}
            </div>
          </div>
          <PolicyReviewTable initialPolicies={policies} />
        </TabsContent>
        
        <TabsContent value="risk-map">
          <RiskMap policies={policies} />
        </TabsContent>
        
        <TabsContent value="policies">
          <PolicyReviewTable initialPolicies={policies} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
