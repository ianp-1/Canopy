import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LayoutDashboard } from "lucide-react"
import { User } from "@supabase/supabase-js"

interface AuthActionsProps {
  user: User | null
}

export function LandingHeaderActions({ user }: AuthActionsProps) {
  // Loading state handled by SSR (html streaming) or initial page load
  // If we wanted a skeleton, we'd use a Suspense boundary in the parent, 
  // but since we fetch in page.tsx, it's blocked there anyway (good for preventing flicker)

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

export function LandingHeroActions({ user }: AuthActionsProps) {
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
