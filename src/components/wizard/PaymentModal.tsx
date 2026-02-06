"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Smartphone, ExternalLink } from "lucide-react"
import Image from "next/image"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: { txHash: string; account: string }) => void
  onError: (error: string) => void
  qrUrl: string | null
  payloadId: string | null
  deepLink: string | null
  amountXrp: number
}

const POLLING_INTERVAL_MS = 3000
const POLLING_TIMEOUT_MS = 300000 // 5 minutes

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  qrUrl,
  payloadId,
  deepLink,
  amountXrp,
}: PaymentModalProps) {
  const [status, setStatus] = useState<"pending" | "opened" | "success" | "rejected" | "expired">("pending")
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!isOpen || !payloadId) return

    let interval: NodeJS.Timeout

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/xrp/payment/check?id=${payloadId}`)
        const data = await res.json()

        if (data.signed) {
          setStatus("success")
          clearInterval(interval)
          onSuccess({ txHash: data.txHash, account: data.account })
          return
        }

        if (data.rejected) {
          setStatus(data.expired ? "expired" : "rejected")
          clearInterval(interval)
          onError(data.expired ? "Payment expired" : "Payment rejected")
          return
        }

        if (data.opened) {
          setStatus("opened")
        }
      } catch {
        // Ignore polling errors
      }
    }

    interval = setInterval(() => {
      setElapsedMs(prev => {
        const newElapsed = prev + POLLING_INTERVAL_MS
        if (newElapsed > POLLING_TIMEOUT_MS) {
          clearInterval(interval)
          setStatus("expired")
          onError("Payment request expired")
        }
        return newElapsed
      })
      pollStatus()
    }, POLLING_INTERVAL_MS)

    // Initial poll
    pollStatus()

    return () => clearInterval(interval)
  }, [isOpen, payloadId, onSuccess, onError])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStatus("pending")
      setElapsedMs(0)
    }
  }, [isOpen])

  const timeRemaining = Math.max(0, Math.ceil((POLLING_TIMEOUT_MS - elapsedMs) / 1000))
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Pay Premium with XRP</DialogTitle>
          <DialogDescription className="text-center">
            Scan with Xaman to pay <span className="font-mono font-bold text-primary">{amountXrp} XRP</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 py-4">
          {/* QR Code */}
          {qrUrl ? (
            <div className="bg-white p-4 rounded-2xl border shadow-sm">
              <Image
                src={qrUrl}
                alt="Payment QR Code"
                width={220}
                height={220}
                unoptimized
                className="rounded-lg"
              />
            </div>
          ) : (
            <div className="w-[220px] h-[220px] bg-muted rounded-2xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Status */}
          <div className="text-center space-y-2">
            {status === "pending" && (
              <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for payment...
              </p>
            )}
            {status === "opened" && (
              <p className="text-sm text-blue-600 flex items-center gap-2 justify-center">
                <Smartphone className="h-4 w-4" />
                Opened in Xaman - Approve to continue
              </p>
            )}
            {status === "rejected" && (
              <p className="text-sm text-red-600">Payment was rejected. Please try again.</p>
            )}
            {status === "expired" && (
              <p className="text-sm text-red-600">Payment request expired.</p>
            )}

            {/* Timer */}
            {(status === "pending" || status === "opened") && (
              <p className="text-xs text-muted-foreground font-mono">
                Expires in {minutes}:{seconds.toString().padStart(2, "0")}
              </p>
            )}
          </div>

          {/* Deep Link Button */}
          {deepLink && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(deepLink, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Open in Xaman App
            </Button>
          )}

          {/* Cancel Button */}
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
