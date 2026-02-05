'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import EmailAuthForm from '@/components/auth/EmailAuthForm'
import AnimatedBackground from '@/components/ui/animated-background'

export default function ResetPasswordPage() {
  return (
    <>
      <AnimatedBackground />
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border border-white/20">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailAuthForm mode="reset" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
