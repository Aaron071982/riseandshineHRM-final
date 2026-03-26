'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin error:', error?.message || error, error?.digest)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-gray-50 dark:bg-[var(--bg-primary)]">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Something went wrong</h1>
        <p className="text-gray-600 dark:text-[var(--text-secondary)]">
          We couldn’t load this page. This can happen when the server is temporarily unavailable or a resource failed to load.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => reset()}
            variant="default"
            className="bg-orange-600 hover:bg-orange-700 text-white border-0"
          >
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/admin/dashboard')}
            variant="outline"
            className="dark:border-[var(--border-medium)] dark:text-[var(--text-secondary)]"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
