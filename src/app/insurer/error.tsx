'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#1B3A2B]">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || 'An unexpected error occurred in the insurer dashboard.'}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center px-4 py-2 bg-[#2E7D32] text-white rounded-full hover:bg-[#1B3A2B] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
