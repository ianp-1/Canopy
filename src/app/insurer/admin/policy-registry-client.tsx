"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, MoreHorizontal, CheckCircle2, AlertCircle, Clock } from "lucide-react"

// Mock Data (Moved from page.tsx)
const policies = [
  { id: "0008KV...289a", farmer: "Iowa Field #4", crop: "Corn", coverage: "50,000 XRP", premium: "150 XRP", risk: "12%", status: "Active", lastUpdate: "2m ago" },
  { id: "0009AB...331b", farmer: "Nebraska Plot 2", crop: "Soy", coverage: "120,000 XRP", premium: "310 XRP", risk: "8%", status: "Active", lastUpdate: "15m ago" },
  { id: "0012CC...992x", farmer: "Kansas Wheat Co", crop: "Wheat", coverage: "80,000 XRP", premium: "200 XRP", risk: "45%", status: "Warning", lastUpdate: "5m ago" },
  { id: "0015DD...110z", farmer: "Ohio Family Farm", crop: "Corn", coverage: "25,000 XRP", premium: "75 XRP", risk: "5%", status: "Active", lastUpdate: "1h ago" },
  { id: "0018EE...221q", farmer: "Dakota Fields", crop: "Soy", coverage: "200,000 XRP", premium: "550 XRP", risk: "88%", status: "Triggered", lastUpdate: "10m ago" },
  { id: "0020FF...883k", farmer: "Texas Ranch 9", crop: "Cotton", coverage: "150,000 XRP", premium: "420 XRP", risk: "15%", status: "Active", lastUpdate: "3h ago" },
]

export function PolicyRegistryClient() {
  return (
    <Card className="border-none shadow-sm bg-white flex-1 flex flex-col">
       <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input placeholder="Search Policy ID, Farmer, or Crop..." className="pl-9 bg-gray-50 border-gray-200" />
          </div>
          <Button variant="outline" className="text-muted-foreground">
             <Filter className="h-4 w-4 mr-2" /> Filter
          </Button>
       </div>
       
       <div className="flex-1 overflow-auto">
          <Table>
             <TableHeader className="bg-gray-50/50">
                <TableRow>
                   <TableHead className="w-[180px]">Policy ID</TableHead>
                   <TableHead>Farmer / Location</TableHead>
                   <TableHead>Crop Type</TableHead>
                   <TableHead>Coverage</TableHead>
                   <TableHead>Risk Score</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Oracle Sync</TableHead>
                   <TableHead className="w-[50px]"></TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
                {policies.map((policy) => (
                   <TableRow key={policy.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-mono text-xs text-muted-foreground">{policy.id}</TableCell>
                      <TableCell className="font-medium text-[#1B3A2B]">{policy.farmer}</TableCell>
                      <TableCell>
                         <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">{policy.crop}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{policy.coverage}</TableCell>
                      <TableCell>
                         <span className={`font-bold ${
                            parseInt(policy.risk) > 50 ? 'text-red-500' : 'text-green-600'
                         }`}>{policy.risk}</span>
                      </TableCell>
                      <TableCell>
                         <StatusBadge status={policy.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-center gap-2">
                         <Clock className="h-3 w-3" /> {policy.lastUpdate}
                      </TableCell>
                      <TableCell>
                         <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                         </Button>
                      </TableCell>
                   </TableRow>
                ))}
             </TableBody>
          </Table>
       </div>
       <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs text-muted-foreground">
           <span>Showing 6 of 1,240 policies</span>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
           </div>
       </div>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
   if (status === "Active") {
      return <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-100 shadow-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>
   }
   if (status === "Warning") {
      return <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-100 shadow-none"><AlertCircle className="w-3 h-3 mr-1" /> Warning</Badge>
   }
   if (status === "Triggered") {
      return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-100 shadow-none"><AlertCircle className="w-3 h-3 mr-1" /> Triggered</Badge>
   }
   return <Badge variant="secondary">{status}</Badge>
}
