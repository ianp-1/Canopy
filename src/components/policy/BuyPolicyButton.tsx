'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface BuyPolicyButtonProps {
    amountXrp: number
    destination: string
    onSuccess?: (txid: string) => void
}

export default function BuyPolicyButton({ amountXrp, destination, onSuccess }: BuyPolicyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [payloadId, setPayloadId] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const handleBuy = async () => {
    setLoading(true)
    setStatus('Creating transaction...')
    try {
        const res = await fetch('/api/payment/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountXrp.toString(), destination })
        })
        const data = await res.json()
        
        if (data.refs && data.refs.qr_png) {
            setQrUrl(data.refs.qr_png)
            setPayloadId(data.uuid)
            setStatus('Scan to Pay')
            
            // If mobile?
            // window.location.href = data.next.always
        }
    } catch (e) {
        console.error(e)
        setStatus('Error creating payment')
        setLoading(false)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (payloadId) {
        interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/payment/check?id=${payloadId}`)
                const data = await res.json()
                
                if (data.signed) {
                    clearInterval(interval)
                    setStatus('Payment Successful!')
                    setQrUrl(null)
                    setPayloadId(null)
                    if (onSuccess && data.txid) onSuccess(data.txid)
                    setLoading(false)
                }
            } catch (e) {
                // ignore
            }
        }, 3000)
    }
    return () => clearInterval(interval)
  }, [payloadId, onSuccess])

  return (
    <div className="flex flex-col gap-4 items-center">
        {!qrUrl ? (
             <Button onClick={handleBuy} disabled={loading}>
                {loading ? status : `Buy Policy (${amountXrp} XRP)`}
             </Button>
        ) : (
             <div className="p-4 border rounded bg-white text-center">
                <p className="mb-2 font-semibold">{status}</p>
                <Image src={qrUrl} alt="Payment QR" width={200} height={200} unoptimized />
                <Button variant="link" onClick={() => setQrUrl(null)} className="mt-2 text-red-500">
                    Cancel
                </Button>
             </div>
        )}
    </div>
  )
}
