'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2 } from 'lucide-react'
import CalendlyEmbed from '@/components/onboarding/CalendlyEmbed'
import { ONBOARDING_ORIENTATION_CALENDLY_URL } from '@/lib/onboarding/catalog'

type OrientationBookingPanelProps = {
  documentId: string
  /** When true, hide the "I've booked" CTA (e.g. already marked complete). */
  alreadyBooked?: boolean
  onBooked?: () => void
  /** Compact copy for the post-onboarding success screen. */
  variant?: 'step' | 'complete'
}

export default function OrientationBookingPanel({
  documentId,
  alreadyBooked = false,
  onBooked,
  variant = 'step',
}: OrientationBookingPanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(alreadyBooked)

  const markBooked = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/rbt/onboarding/booking/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentId }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Could not mark booking complete')
        return
      }
      setDone(true)
      onBooked?.()
    } catch {
      setError('Could not mark booking complete')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-gray-600">
        {variant === 'complete' ? (
          <>
            <p className="text-base font-medium text-gray-900">Next step: schedule your orientation</p>
            <p>
              Book a 60-minute session with your supervisor. After you pick a time, confirm below so we
              know you&apos;re scheduled.
            </p>
          </>
        ) : (
          <>
            <p>
              Book your 60-minute orientation session below. Once you&apos;ve chosen a time, confirm so
              we can mark this step complete.
            </p>
          </>
        )}
      </div>

      <CalendlyEmbed url={ONBOARDING_ORIENTATION_CALENDLY_URL} />

      {done ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Orientation booked — thank you
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            type="button"
            className="bg-[#e36f1e] hover:bg-[#c95e18]"
            disabled={submitting}
            onClick={() => void markBooked()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "I've booked my session"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
