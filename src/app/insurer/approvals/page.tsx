import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPendingPolicies } from "@/app/insurer/actions"
import { ApprovalQueueClient } from "./approval-queue-client"
import { ClipboardCheck } from "lucide-react"

export const metadata: Metadata = {
  title: 'Policy Approvals',
}

function ApprovalsSkeleton() {
  return (
    <Card className="border-none shadow-sm bg-white flex-1 animate-pulse">
      <CardHeader className="border-b border-gray-100">
        <div className="h-6 w-48 bg-gray-200 rounded" />
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

async function ApprovalQueueWrapper() {
  const pendingPolicies = await getPendingPolicies()
  return <ApprovalQueueClient policies={pendingPolicies} />
}

export default function PolicyApprovalsPage() {
  return (
    <div className="p-8 space-y-8 font-sans h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#1B3A2B] tracking-tight flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-[#2E7D32]" />
            Policy Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve pending policy applications from farmers.
          </p>
        </div>
      </div>

      {/* Approval Queue */}
      <Suspense fallback={<ApprovalsSkeleton />}>
        <ApprovalQueueWrapper />
      </Suspense>
    </div>
  )
}
