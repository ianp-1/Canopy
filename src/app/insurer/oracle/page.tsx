
import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Radio, RefreshCcw, Power, ShieldAlert, Terminal } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

export const metadata: Metadata = {
  title: 'Oracle Console',
}

export default function OracleConsole() {
  return (
    <div className="p-8 space-y-8 font-sans h-full flex flex-col">
      
      <div className="flex justify-between items-start">
         <div className="space-y-1">
            <h1 className="text-3xl font-bold text-[#1B3A2B] tracking-tight flex items-center gap-3">
               <Radio className="h-6 w-6 text-[#2E7D32]" />
               Oracle Network Console
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               System Operational
               <span className="text-gray-300">|</span>
               <span className="font-mono text-xs">v2.4.0-stable</span>
            </p>
         </div>
         <div className="flex gap-2">
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
               <Power className="h-4 w-4 mr-2" /> Emergency Stop
            </Button>
            <Button variant="outline" className="bg-white hover:text-[#2E7D32]">
               <RefreshCcw className="h-4 w-4 mr-2" /> Force Sync
            </Button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Node Status */}
         <StatusCard 
            id="Node Alpha" 
            status="active" 
            latency="42ms" 
            source="NOAA-G7" 
            role="Primary" 
         />
         <StatusCard 
            id="Node Beta" 
            status="active" 
            latency="45ms" 
            source="Copernicus-EU" 
            role="Validating" 
         />
         <StatusCard 
            id="Node Gamma" 
            status="syncing" 
            latency="---" 
            source="OpenWeatherMap" 
            role="Standby" 
         />
      </div>

      {/* Terminal Layout */}
      <Card className="flex-1 bg-[#0F172A] border-none shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
         <div className="bg-[#1E293B] px-4 py-2 flex items-center justify-between border-b border-[#334155]">
            <div className="flex items-center gap-2 text-slate-400">
               <Terminal className="h-4 w-4" />
               <span>/var/log/oracle-mainnet.log</span>
            </div>
            <div className="flex gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
               <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
               <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
            </div>
         </div>
         <div className="flex-1 p-4 overflow-y-auto space-y-2 text-slate-300">
             <LogEntry time="10:42:01" level="INFO">Initializing health check routine [Interval: 300s]</LogEntry>
             <LogEntry time="10:42:01" level="DEBUG" color="text-blue-400">Fetching telemetry from SOURCE_NOAA_G7...</LogEntry>
             <LogEntry time="10:42:02" level="SUCCESS" color="text-green-400">Payload received: 42kb. Parsing...</LogEntry>
             <LogEntry time="10:42:03" level="INFO">Validating signature 0x882...99a</LogEntry>
             <LogEntry time="10:42:03" level="SUCCESS" color="text-green-400">Signature Valid. Broadcasting to XRPL...</LogEntry>
             <LogEntry time="10:42:04" level="TX" color="text-yellow-400">Transaction Submitted: Hash 7A9...3B2</LogEntry>
             <LogEntry time="10:42:05" level="INFO">Consensus reached (Ledger #8829104)</LogEntry>
             <LogEntry time="10:45:00" level="WARN" color="text-orange-400">Latency spike detected on Node Gamma (120ms)</LogEntry>
             <LogEntry time="10:45:01" level="INFO">Rerouting validation tasks to Node Beta</LogEntry>
             <div className="h-4 w-2 bg-green-500 animate-pulse mt-2" />
         </div>
      </Card>

    </div>
  )
}

interface StatusCardProps {
  id: string
  status: 'active' | 'syncing' | 'offline'
  latency: string
  source: string
  role: string
}

function StatusCard({ id, status, latency, source, role }: StatusCardProps) {
    const isOnline = status === 'active'
    
    return (
       <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
             <div className="space-y-1">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 animate-pulse'}`} />
                   <h3 className="font-bold text-[#1B3A2B]">{id}</h3>
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{role}</p>
             </div>
             <div className="text-right space-y-1">
                <Badge variant="outline" className="font-mono border-gray-100 bg-gray-50 text-gray-600">{latency}</Badge>
                <p className="text-[10px] text-muted-foreground">{source}</p>
             </div>
          </CardContent>
       </Card>
    )
 }

interface LogEntryProps {
  time: string
  level: string
  color?: string
  children: React.ReactNode
}

function LogEntry({ time, level, color = "text-slate-300", children }: LogEntryProps) {
    return (
       <div className="flex gap-3 hover:bg-white/5 p-0.5 rounded">
          <span className="text-slate-500 opacity-50 select-none">[{time}]</span>
          <span className={`font-bold w-16 ${color}`}>{level}</span>
          <span className="text-slate-300">{children}</span>
       </div>
    )
 }
