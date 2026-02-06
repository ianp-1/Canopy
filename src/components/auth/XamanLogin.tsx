'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function XamanLogin() {
  const [loading, setLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [payloadId, setPayloadId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  const startLogin = async () => {
    setLoading(true)
    setStatus('Initializing...')
    try {
      const res = await fetch('/api/auth/xaman/nonce', { method: 'POST' })
      const data = await res.json()
      
      if (data.refs && data.refs.qr_png) {
        setQrUrl(data.refs.qr_png)
        setPayloadId(data.uuid)
        setStatus('Scan the QR code with Xaman')
        
        // If mobile, try to open app?
        // window.location.href = data.next.always
      }
    } catch (e) {
      console.error(e)
      setStatus('Error starting login')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (payloadId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/xaman/check?id=${payloadId}`)
          const data = await res.json()
          
          if (data.signed && data.type === 'magiclink') {
             clearInterval(interval)
             setStatus('Verifying session...')
             
             // Use verifyOtp with the token_hash from the magic link
             if (data.tokenHash) {
               const { error } = await supabase.auth.verifyOtp({
                 token_hash: data.tokenHash,
                 type: 'magiclink'
               })
               
               if (error) {
                 console.error('Verify OTP error:', error)
                 setStatus('Session verification failed')
                 return
               }
               
               // Session is set, redirect to dashboard
               router.push('/dashboard')
             } else {
               // Fallback: redirect via magic link
               window.location.href = data.magicLink
             }
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [payloadId, router, supabase.auth])

  return (
    <div className="flex flex-col items-center gap-4">
      {!qrUrl ? (
        <Button onClick={startLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            {loading ? 'Loading...' : 'Sign in with Xaman'}
        </Button>
      ) : (
        <div className="text-center p-4 border rounded-lg bg-gray-50 flex flex-col items-center">
            <p className="mb-2 text-sm text-gray-600">{status}</p>
            <Image src={qrUrl} alt="Xaman QR" width={200} height={200} unoptimized />
            <p className="mt-2 text-xs text-gray-500">Or</p>
            <Button variant="outline" size="sm" onClick={() => window.open(`https://xumm.app/sign/${payloadId}`, '_blank')}>
                Open in Xaman App
            </Button>
        </div>
      )}
    </div>
  )
}
