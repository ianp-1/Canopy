'use client'

import React from 'react'
import Link from 'next/link'
import { 
  LogOut, 
  Settings, 
  User as UserIcon, 
  Wallet,
  ShieldCheck,
  LayoutDashboard
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/auth-provider'
import { cn } from '@/lib/utils'

export function UserProfileButton({ className }: { className?: string }) {
  const { user, signOut, loading } = useAuth()

  if (loading) {
    return (
      <div className={cn("h-9 w-9 rounded-full bg-muted animate-pulse", className)} />
    )
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="default" size="sm" className="font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
          Sign In
        </Button>
      </Link>
    )
  }

  // Get user initials or fallback
  const initials = user.email 
    ? user.email.substring(0, 2).toUpperCase() 
    : 'U'

  // Get display name (metadata or email part)
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary/10 hover:ring-primary/30 transition-all hover:scale-105 active:scale-95 p-0 overflow-hidden">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground w-full truncate">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <Link href="/dashboard">
              <DropdownMenuItem className="cursor-pointer">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/account/settings">
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <Link href="/account/settings?tab=wallet">
              <DropdownMenuItem className="cursor-pointer">
                <Wallet className="mr-2 h-4 w-4" />
                <span>Manage Wallet</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/account/settings?tab=security">
              <DropdownMenuItem className="cursor-pointer">
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span>Security</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="text-red-500 hover:text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
