"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Smartphone, ExternalLink, CheckCircle } from "lucide-react"
import Image from "next/image"
import { createNFTAcceptRequest, checkNFTAcceptStatus } from "@/app/actions/payment"
import { useRouter } from "next/navigation"

interface PolicyNFTClaimProps {
  offerId: string
  policyId: string
}

type ClaimStatus = "pending" | "opened" | "success" | "rejected" | "expired"

export function PolicyNFTClaim({ offerId, policyId }: PolicyNFTClaimProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [payloadId, setPayloadId] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [status, setStatus] = useState<ClaimStatus>("pending")
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClaim = async () => {
    setIsOpen(true)
    setIsLoading(true)
    setError(null)
    setStatus("pending")

    try {
      const result = await createNFTAcceptRequest(offerId)

      if (result.success && result.qrUrl && result.payloadId) {
        setQrUrl(result.qrUrl)
        setPayloadId(result.payloadId)
        setDeepLink(result.deepLink || null)
      } else {
        setError(result.error || "Failed to generate claim request")
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Poll for status
  useEffect(() => {
    if (!isOpen || !payloadId || status === "success" || status === "rejected" || status === "expired") return

    const interval = setInterval(async () => {
      try {
        const check = await checkNFTAcceptStatus(payloadId)

        if ('signed' in check && check.signed) {
          setStatus("success")
          setQrUrl(null)
          router.refresh() // Refresh page to show updated NFT status
        } else if ('rejected' in check && check.rejected) {
          setStatus(check.expired ? "expired" : "rejected")
          setQrUrl(null)
        } else if ('opened' in check && check.opened) {
          setStatus("opened")
        }
      } catch (e) {
        console.error("Polling error", e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [isOpen, payloadId, status, router])

  // Reset state on close
  const handleClose = () => {
    setIsOpen(false)
    // Small delay to reset state to avoid flickering while closing
    setTimeout(() => {
      setQrUrl(null)
      setPayloadId(null)
      setStatus("pending")
      setError(null)
    }, 300)
  }



  return (
    <>
      <Button
        onClick={handleClaim}
        variant="outline"
        className="w-full mt-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
      >
        <Smartphone className="w-4 h-4 mr-2" />
        Claim Policy NFT
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Claim Policy NFT</DialogTitle>
            <DialogDescription className="text-center">
              Scan with Xaman to accept the NFT transfer
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center space-y-6 py-4">
            {isLoading ? (
              <div className="w-[220px] h-[220px] bg-muted rounded-2xl flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center space-y-4">
                <div className="text-destructive font-medium">{error}</div>
                <Button variant="outline" onClick={handleClaim}>Try Again</Button>
              </div>
            ) : qrUrl ? (
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <Image
                  src={qrUrl}
                  alt="Claim QR Code"
                  width={220}
                  height={220}
                  unoptimized
                  className="rounded-lg"
                />
              </div>
            ) : status === "success" ? (
              <div className="w-[220px] h-[220px] flex flex-col items-center justify-center space-y-4 text-green-600">
                <CheckCircle className="h-16 w-16" />
                <p className="font-semibold">NFT Claimed!</p>
              </div>
            ) : null}

            <div className="text-center space-y-2">
              {status === "opened" && (
                <p className="text-sm text-blue-600 flex items-center gap-2 justify-center">
                  <Smartphone className="h-4 w-4" />
                  Opened in Xaman - Sign to accept
                </p>
              )}
              {status === "rejected" && (
                <p className="text-sm text-red-600">Request rejected or expired.</p>
              )}
            </div>

            {deepLink && !error && !isLoading && status !== "success" && (
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
