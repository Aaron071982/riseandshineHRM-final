'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Shield, Mail } from 'lucide-react'
import { CS_ACCENT } from '@/lib/client-services/uiTheme'

export default function ElevateGate({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'sent' | 'verifying'>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/client-services/auth/elevate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to send code')
        return
      }
      setStep('sent')
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/client-services/auth/elevate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Verification failed')
        return
      }
      setStep('verifying')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-8">
        <div className="flex justify-center mb-4">
          <div
            className="rounded-full p-4 border border-[#E5E7EB]"
            style={{ backgroundColor: CS_ACCENT.bg }}
          >
            <Shield className="w-9 h-9" style={{ color: CS_ACCENT.solid }} />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-center text-[#1a1d21] mb-2">
          Step-up verification required
        </h2>
        <p className="text-sm text-[#5F6B7A] text-center mb-6 leading-relaxed">
          Client Services holds protected health information. Confirm your identity with a one-time
          code sent to <span className="text-[#1a1d21] font-medium">{userEmail}</span>. Access
          lasts 30 minutes.
        </p>

        {step === 'idle' && (
          <Button
            className="w-full text-white"
            style={{ backgroundColor: CS_ACCENT.solid }}
            onClick={send}
            disabled={busy}
          >
            <Mail className="w-4 h-4 mr-2" />
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
        )}

        {(step === 'sent' || step === 'verifying') && (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-center" style={{ color: '#0F6E56' }}>
              Code sent. Check your inbox.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-4 py-3 text-center text-2xl tracking-[0.35em] text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/40"
            />
            <Button
              type="submit"
              className="w-full text-white"
              style={{ backgroundColor: CS_ACCENT.solid }}
              disabled={busy || code.length !== 6}
            >
              {busy ? 'Verifying…' : 'Enter Client Services'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-[#5F6B7A] hover:text-[#1a1d21]"
              onClick={send}
              disabled={busy}
            >
              Resend code
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-center" style={{ color: '#A32D2D' }}>{error}</p>}
      </div>
    </div>
  )
}
