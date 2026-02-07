"use client"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { X, CheckCircle2, AlertCircle } from "lucide-react"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
            "animate-in slide-in-from-bottom-5 fade-in duration-200",
            toast.variant === "destructive"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-green-200 bg-white text-[#1B3A2B]"
          )}
        >
          <div className="flex items-start gap-3">
            {toast.variant === "destructive" ? (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            )}
            <div className="grid gap-1">
              {toast.title && (
                <div className="text-sm font-semibold">{toast.title}</div>
              )}
              {toast.description && (
                <div className="text-sm opacity-90">{toast.description}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
