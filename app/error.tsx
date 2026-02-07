'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error?.message || error, error?.digest)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-muted-foreground">
          We couldn’t load this page. This can happen when the server is temporarily unavailable or your session expired.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => reset()} variant="default" className="rounded-xl">
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="outline"
            className="rounded-xl"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
