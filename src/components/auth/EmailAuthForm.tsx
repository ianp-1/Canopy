'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp, signIn, resetPassword, type AuthResult } from '@/app/actions/auth'
import Link from 'next/link'

interface EmailAuthFormProps {
  mode: 'signin' | 'signup' | 'reset'
  onModeChange?: (mode: 'signin' | 'signup') => void
}

export default function EmailAuthForm({ mode, onModeChange }: EmailAuthFormProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuthResult | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setResult(null)
    
    let response: AuthResult
    
    if (mode === 'signup') {
      response = await signUp(formData)
    } else if (mode === 'reset') {
      response = await resetPassword(formData)
    } else {
      response = await signIn(formData)
    }
    
    setResult(response)
    setLoading(false)
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {result?.error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {result.error}
        </div>
      )}
      
      {result?.success && result.message && (
        <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
          {result.message}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>

      {mode !== 'reset' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === 'signin' && (
              <Link 
                href="/auth/reset-password" 
                className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
          />
        </div>
      )}

      {mode === 'signup' && (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {mode === 'signin' ? 'Signing in...' : mode === 'signup' ? 'Creating account...' : 'Sending reset link...'}
          </span>
        ) : (
          mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'
        )}
      </Button>

      {mode !== 'reset' && onModeChange && (
        <div className="text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => onModeChange('signup')}
                className="text-primary hover:underline underline-offset-4"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onModeChange('signin')}
                className="text-primary hover:underline underline-offset-4"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      )}

      {mode === 'reset' && (
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      )}
    </form>
  )
}
