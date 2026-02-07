import type { Metadata } from 'next'
import { Button } from "@/components/ui/button"
import { PolicyRegistryClient } from "./policy-registry-client"
import { getAllPolicies } from "../actions"

export const metadata: Metadata = {
  title: 'Policy Registry',
}

export default async function AdminRegistry() {
  const policies = await getAllPolicies()

  return (
    <div className="p-8 space-y-8 font-sans h-full flex flex-col">
      
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-bold text-[#1B3A2B] tracking-tight">Policy Registry</h1>
            <p className="text-muted-foreground mt-1">Manage active contracts and view ledger metadata.</p>
         </div>
      </div>

      <PolicyRegistryClient initialPolicies={policies} />
    </div>
  )
}
