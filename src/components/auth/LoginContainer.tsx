'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { GoogleIcon } from '@/components/ui/icons'
import EmailAuthForm from '@/components/auth/EmailAuthForm'
import XamanLogin from '@/components/auth/XamanLogin'

export default function LoginContainer() {
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const supabase = useMemo(() => createClient(), [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border border-white/20">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold">
            {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'signin'
              ? 'Sign in to your account to continue'
              : 'Enter your details to create an account'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email/Password Form */}
          <EmailAuthForm mode={authMode} onModeChange={setAuthMode} />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Social & Wallet Logins */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full flex gap-2 items-center justify-center"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <XamanLogin />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
