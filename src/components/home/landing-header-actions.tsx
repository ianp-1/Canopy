'use client'

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LayoutDashboard } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

export function LandingHeaderActions() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="h-10 w-24 bg-muted/20 animate-pulse rounded-md" />
  }

  if (user) {
    return (
      <Link href="/dashboard">
        <Button className="font-semibold shadow-lg shadow-primary/20 gap-2">
          <LayoutDashboard size={18} />
          Dashboard
        </Button>
      </Link>
    )
  }

  return (
    <>
      <Link href="/login">
         <Button variant="ghost" className="text-foreground">Log In</Button>
      </Link>
      <Link href="/wizard">
        <Button className="font-semibold shadow-lg shadow-primary/20">
          Get Protected
        </Button>
      </Link>
    </>
  )
}

export function LandingHeroActions() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="h-14 w-40 bg-muted/20 animate-pulse rounded-md" />
  }

  if (user) {
    return (
      <Link href="/dashboard">
        <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-primary/20 border-2 border-transparent gap-2">
          <LayoutDashboard size={20} />
          Go to Dashboard
        </Button>
      </Link>
    )
  }

  return (
    <Link href="/wizard">
      <Button size="lg" className="h-14 px-8 text-lg shadow-xl shadow-primary/20 border-2 border-transparent">
        Start Quote
      </Button>
    </Link>
  )
}
