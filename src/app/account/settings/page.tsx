'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Wallet, ShieldCheck, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import XamanLogin from '@/components/auth/XamanLogin'
import { GoogleIcon } from '@/components/ui/icons'
import { getUserWallet, linkWallet, unlinkWallet } from '@/app/actions/auth'
import { checkPaymentStatus } from '@/app/actions/payment'
import { useState, useEffect } from 'react'
import Image from 'next/image'

import { Suspense } from 'react'

function WalletSettingsTab() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  
  // Poll for wallet status and linking
  useEffect(() => {
    // Initial check
    getUserWallet().then(setWalletAddress)
  }, [])

  const handleLinkWallet = async () => {
    setIsLinking(true)
    try {
      // Create sign-in request for wallet linking
      const res = await fetch('/api/auth/xaman/nonce', { method: 'POST' })
      const data = await res.json()
      
      if (data.refs?.qr_png) {
        setQrUrl(data.refs.qr_png)
        
        // Poll for payload resolution
        const interval = setInterval(async () => {
          const check = await checkPaymentStatus(data.uuid) // Reusing checkPaymentStatus as it checks payload
          if ('signed' in check && check.signed && check.account) {
             clearInterval(interval)
             await linkWallet(data.uuid)
             const newAddr = await getUserWallet()
             setWalletAddress(newAddr)
             setQrUrl(null)
             setIsLinking(false)
          }
        }, 3000)
        
        // Timeout after 5 mins
        setTimeout(() => clearInterval(interval), 300000)
      }
    } catch (e) {
      console.error(e)
      setIsLinking(false)
    }
  }

  const handleUnlink = async () => {
    if (confirm('Are you sure you want to disconnect your wallet?')) {
      await unlinkWallet()
      setWalletAddress(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Wallets</CardTitle>
        <CardDescription>
          Manage your XRPL wallet connections for policy payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black rounded-full text-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Xaman (Xumm) Wallet</p>
                    <p className="text-sm text-muted-foreground">
                      {walletAddress ? `Connected: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Connect to sign transactions'}
                    </p>
                  </div>
                </div>
                
                {walletAddress ? (
                  <Button variant="outline" size="sm" onClick={handleUnlink} className="hover:bg-destructive/10 hover:text-destructive cursor-pointer">
                    Disconnect
                  </Button>
                ) : (
                  !isLinking && (
                    <Button size="sm" onClick={handleLinkWallet} className="cursor-pointer">
                      Connect Wallet
                    </Button>
                  )
                )}
             </div>

             {qrUrl && !walletAddress && (
               <div className="flex flex-col items-center p-4 border-t gap-2">
                 <p className="text-sm font-medium">Scan with Xaman App</p>
                 <Image src={qrUrl} alt="Scan to connect" width={180} height={180} className="rounded-lg border bg-white" unoptimized />
                 <Button variant="ghost" size="sm" onClick={() => { setQrUrl(null); setIsLinking(false) }} className="cursor-pointer">
                   Cancel
                 </Button>
               </div>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AccountSettingsContent() {
  const { user, loading } = useAuth()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'profile'

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Please sign in to view settings</h2>
        <Button onClick={() => window.location.href = '/login'}>Sign In</Button>
      </div>
    )
  }

  // Get user details
  const email = user.email || ''
  const fullName = user.user_metadata?.full_name || ''
  const avatarUrl = user.user_metadata?.avatar_url
  const providers = user.app_metadata?.providers || []
  
  const isGoogleLinked = providers.includes('google')
  const isEmailLinked = providers.includes('email')

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile, wallet connections, and security preferences.
          </p>
        </div>
        
        <Separator />

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal details and public profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-xl">
                      {email.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-medium">Profile Picture</h3>
                    <p className="text-sm text-muted-foreground">
                      Managed via your identify provider (Google/Gravatar).
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" defaultValue={fullName} disabled />
                    <p className="text-[0.8rem] text-muted-foreground">
                      Name is synced from your login provider.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" defaultValue={email} disabled />
                    <p className="text-[0.8rem] text-muted-foreground">
                      Your primary contact email.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WALLET TAB */}
          <TabsContent value="wallet" className="space-y-6">
            <WalletSettingsTab />
          </TabsContent>

          {/* SECURITY TAB */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Linked Identities</CardTitle>
                <CardDescription>
                  Manage the services you use to sign in to Canopy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  
                  {/* Google Link */}
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <GoogleIcon />
                      <div>
                        <p className="font-medium">Google</p>
                        <p className="text-xs text-muted-foreground">
                          {isGoogleLinked ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {isGoogleLinked ? (
                      <div className="flex items-center text-green-600 gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </div>
                    ) : (
                      <Button variant="outline" size="sm">Connect</Button>
                    )}
                  </div>

                  {/* Email Link */}
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">Email & Password</p>
                        <p className="text-xs text-muted-foreground">
                          {isEmailLinked ? `Connected as ${email}` : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {isEmailLinked && (
                       <div className="flex items-center text-green-600 gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>


          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading settings...</div>}>
      <AccountSettingsContent />
    </Suspense>
  )
}
