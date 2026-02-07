import type { Metadata } from 'next'
import { Button } from "@/components/ui/button"
import { PolicyRegistryClient } from "./policy-registry-client"

export const metadata: Metadata = {
  title: 'Policy Registry',
}

export default function AdminRegistry() {
  return (
    <div className="p-8 space-y-8 font-sans h-full flex flex-col">
      
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-bold text-[#1B3A2B] tracking-tight">Policy Registry</h1>
            <p className="text-muted-foreground mt-1">Manage active contracts and view ledger metadata.</p>
         </div>
         <Button className="bg-[#1B3A2B] text-white hover:bg-[#2E7D32]">
            Export CSV
         </Button>
      </div>

      <PolicyRegistryClient />
    </div>
  )
}
