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
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-background dark:bg-[var(--bg-primary)] text-foreground dark:text-[var(--text-primary)]">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground dark:text-[var(--text-primary)]">Something went wrong</h1>
        <p className="text-muted-foreground dark:text-[var(--text-secondary)]">
          We couldn’t load this page. This can happen when the server is temporarily unavailable or your session expired.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => reset()} variant="default" className="rounded-xl dark:bg-[var(--orange-primary)] dark:text-[var(--text-on-orange)] dark:hover:bg-[var(--orange-hover)] dark:border-0">
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="outline"
            className="rounded-xl dark:border-[var(--border-medium)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
