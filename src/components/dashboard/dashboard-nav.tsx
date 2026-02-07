"use client"

import Link from "next/link"
{/* usePathname import removed */}
import { cn } from "@/lib/utils"
import { LayoutDashboard, Wand2 } from "lucide-react"
{/* Button import removed */}

export function DashboardNav() {
  return (
    <div className="h-full flex flex-col justify-between py-6">
       <div className="space-y-6">
          <div className="px-6 flex items-center space-x-2">
             <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-white font-bold text-lg">C</span>
             </div>
             <span className="text-xl font-bold tracking-tight text-foreground">Canopy</span>
          </div>
          
          <nav className="space-y-1 px-4">
             <NavLink href="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
{/* Marketplace link removed */}
             <NavLink href="/wizard" icon={Wand2}>New Policy</NavLink>
{/* Claims link removed */}
          </nav>
       </div>

       <div className="px-4 space-y-1">
          {/* Settings and Sign Out removed */}
       </div>
    </div>
  )
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
   // Simplified for visual build - normally would maintain state or check pathname
   const isActive = href === "/dashboard" 
   
   return (
      <Link href={href} className={cn(
         "flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
         isActive 
            ? "bg-primary text-white shadow-md shadow-primary/20" 
            : "text-muted-foreground hover:bg-white hover:text-foreground"
      )}>
         <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-muted-foreground")} />
         <span>{children}</span>
      </Link>
   )
}
