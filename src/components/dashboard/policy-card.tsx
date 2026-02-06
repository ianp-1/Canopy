import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, ShieldCheck, AlertCircle, Wallet } from "lucide-react"

interface PolicyCardProps {
  id: string
  crop: string
  cropEmoji?: string
  region: string
  coverage: string
  premium: string
  status: "active" | "claimed" | "expired" | "pending"
  createdAt?: Date
}

export function PolicyCard({ 
  id, 
  crop, 
  cropEmoji = "🌾",
  region, 
  coverage, 
  premium, 
  status,
  createdAt,
}: PolicyCardProps) {
  const isActive = status === "active"
  const isClaimed = status === "claimed"
  
  const statusConfig = {
    active: {
      badge: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
      icon: ShieldCheck,
      label: "Protected",
    },
    claimed: {
      badge: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200",
      icon: Wallet,
      label: "Claimed",
    },
    expired: {
      badge: "bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200",
      icon: AlertCircle,
      label: "Expired",
    },
    pending: {
      badge: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200",
      icon: AlertCircle,
      label: "Pending",
    },
  }
  
  const config = statusConfig[status] || statusConfig.pending
  const StatusIcon = config.icon
  
  return (
    <Card className="hover:scale-[1.02] transition-transform duration-300 cursor-pointer border-none shadow-sm hover:shadow-md bg-white group">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
         <div className="space-y-1">
            <CardTitle className="text-xl font-bold">{crop}</CardTitle>
            <CardDescription className="line-clamp-1">{region}</CardDescription>
         </div>
         <div className="h-10 w-10 bg-secondary/30 rounded-full flex items-center justify-center text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-xl">
            {cropEmoji}
         </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
         <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Coverage</span>
            <span className="font-mono font-semibold">{coverage} XRP</span>
         </div>
         <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Premium</span>
            <span className="font-mono">{premium} XRP</span>
         </div>
         {createdAt && (
           <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
             <span>Created</span>
             <span>{new Date(createdAt).toLocaleDateString()}</span>
           </div>
         )}
      </CardContent>

      <CardFooter className="pt-2 flex justify-between items-center">
         <Badge 
           variant="secondary" 
           className={`shadow-none border ${config.badge}`}
         >
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
         </Badge>
         <Button variant="ghost" size="sm" className="hidden group-hover:flex p-0 h-auto text-primary hover:text-primary/80 hover:bg-transparent">
            Details <ArrowRight className="w-4 h-4 ml-1" />
         </Button>
      </CardFooter>
    </Card>
  )
}
