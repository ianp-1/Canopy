'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function XamanConfirmContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState('Finalizing login...')

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
        const supabase = createClient()
        // setSession requires refresh_token usually, but for custom JWTs we might trick it
        // ref: https://github.com/supabase/supabase-js/issues/302
        // Actually, best way is setting the cookie manually via a server action or API?
        // But supabase.auth.setSession(accessToken, refreshToken)
        // If we don't have a refresh token (we don't), we can't get session refresh functionality.
        // But we have a 1-week valid JWT.
        
        supabase.auth.setSession({
            access_token: token,
            refresh_token: token // Hack: Pass same token. It will fail refresh but session works?
        }).then(({ data, error }) => {
            if (error) {
                console.error('Session error', error)
                setStatus('Login failed: ' + error.message)
            } else {
                router.push('/dashboard')
            }
        })
    } else {
        setStatus('No token found.')
    }
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Authenticating</h1>
        <p className="text-gray-500">{status}</p>
      </div>
    </div>
  )
}

export default function XamanConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
           <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <XamanConfirmContent />
    </Suspense>
  )
}
