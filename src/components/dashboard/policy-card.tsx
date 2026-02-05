import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, ShieldCheck, AlertCircle } from "lucide-react"

interface PolicyCardProps {
  id: string
  crop: string
  location: string
  coverage: string
  premium: string
  status: "active" | "pending" | "claim"
}

export function PolicyCard({ id, crop, location, coverage, premium, status }: PolicyCardProps) {
  const isHealthy = status === "active"
  
  return (
    <Card className="hover:scale-[1.02] transition-transform duration-300 cursor-pointer border-none shadow-sm hover:shadow-md bg-white group">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
         <div className="space-y-1">
            <CardTitle className="text-xl font-bold">{crop}</CardTitle>
            <CardDescription className="line-clamp-1">{location}</CardDescription>
         </div>
         <div className="h-10 w-10 bg-secondary/30 rounded-full flex items-center justify-center text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {crop === "Corn" ? "🌽" : crop === "Soy" ? "🌱" : "🌾"}
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
      </CardContent>

      <CardFooter className="pt-2 flex justify-between items-center">
         <Badge variant={isHealthy ? "default" : "destructive"} className={isHealthy ? "bg-green-100 text-green-700 hover:bg-green-200 shadow-none border border-green-200" : ""}>
            {isHealthy ? (
               <>
                  <ShieldCheck className="w-3 h-3 mr-1" /> Protected
               </>
            ) : (
               <>
                  <AlertCircle className="w-3 h-3 mr-1" /> Action Needed
               </>
            )}
         </Badge>
         <Button variant="ghost" size="sm" className="hidden group-hover:flex p-0 h-auto text-primary hover:text-primary/80 hover:bg-transparent">
            Details <ArrowRight className="w-4 h-4 ml-1" />
         </Button>
      </CardFooter>
    </Card>
  )
}
