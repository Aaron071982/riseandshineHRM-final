'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export default function ElevateGate({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/client-services/auth/elevate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Invalid access code')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md">
      <div className="rounded-xl border border-line bg-surface p-8">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-line bg-[color-mix(in_srgb,var(--brand)_10%,white)] p-4">
            <ShieldCheck className="h-9 w-9 text-brand" />
          </div>
        </div>

        <h2 className="text-center font-display text-lg font-semibold text-ink">
          Restricted — client PHI
        </h2>
        <p className="mx-auto mt-2 mb-6 text-center text-sm leading-relaxed text-quiet">
          Enter the Client Services access code to unlock this section for{' '}
          <span className="font-medium text-ink">{userEmail}</span>. The session
          ends after 1 hour of inactivity (max 12 hours).
        </p>

        <form onSubmit={unlock} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="Access code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            className="w-full rounded-lg border border-line bg-[var(--bg)] px-4 py-3 text-center text-2xl tracking-[0.35em] text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          />
          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="h-11 w-full rounded-lg bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock Client Services'}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-center text-sm text-[var(--urgent)]">{error}</p>
        )}
      </div>
    </div>
  )
}
