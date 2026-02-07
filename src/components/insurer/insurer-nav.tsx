"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import { LayoutDashboard, Radio, Server, Settings, LogOut, Zap, ClipboardCheck, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InsurerNav() {
  return (
    <div className="h-full flex flex-col justify-between py-6 bg-[#1B3A2B] text-white">
       {/* Brand - White Logo on Dark Green */}
       <div className="space-y-8">
          <div className="px-6 flex items-center space-x-3">
             <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                <span className="text-white font-bold text-lg">C</span>
             </div>
             <div>
                <span className="text-xl font-bold tracking-tight block leading-none">Canopy</span>
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-medium">Insurer Portal</span>
             </div>
          </div>
          
          <nav className="space-y-1 px-4">
             <NavLink href="/insurer/dashboard" icon={LayoutDashboard}>Command Center</NavLink>
             <NavLink href="/insurer/approvals" icon={ClipboardCheck}>Approvals</NavLink>
             <NavLink href="/insurer/policies" icon={Server}>Policy Registry</NavLink>
             <NavLink href="/insurer/oracle-simulator" icon={Zap}>Pavilion Simulator</NavLink>
          </nav>
       </div>

       <div className="px-4 space-y-1">
          <NavLink href="#" icon={Settings}>Settings</NavLink>
          <Button variant="ghost" className="w-full justify-start px-4 py-6 text-white/50 hover:bg-white/10 hover:text-white space-x-3 rounded-xl transition-colors">
             <LogOut className="h-5 w-5" />
             <span>Sign Out</span>
          </Button>
       </div>
    </div>
  )
}

interface NavLinkProps {
  href: string
  icon: LucideIcon
  children: React.ReactNode
}

function NavLink({ href, icon: Icon, children }: NavLinkProps) {
   const pathname = usePathname()
   const isActive = pathname === href
   
   return (
      <Link href={href} className={cn(
         "flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 border border-transparent",
         isActive 
            ? "bg-white/10 text-white shadow-inner border-white/5" 
            : "text-white/60 hover:bg-white/5 hover:text-white"
      )}>
         <Icon className={cn("h-5 w-5", isActive ? "text-[#4CAF50]" : "text-white/60")} />
         <span>{children}</span>
      </Link>
   )
}
