'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global application error:', error?.message || error, error?.digest)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '32rem', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Something went wrong</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          We couldn’t load the app. Please try again or go back to the home page.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              background: '#E4893D',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Go home
          </button>
        </div>
      </body>
    </html>
  )
}
