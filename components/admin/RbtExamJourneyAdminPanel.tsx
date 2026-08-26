'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { PEARSON_VUE_BACB_URL } from '@/lib/rbt/examJourneyConstants'

export type ExamFeeRequestRow = {
  id: string
  status: string
  note: string | null
  adminNote: string | null
  createdAt: string | Date
  reviewedAt: string | Date | null
}

type Props = {
  rbtProfileId: string
  scheduledAt: string | Date | null
  outcome: string | null
  outcomeAt: string | Date | null
  journeySeenAt: string | Date | null
  feeRequests: ExamFeeRequestRow[]
  onRefresh?: () => void
}

function fmt(d: string | Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function RbtExamJourneyAdminPanel({
  rbtProfileId,
  scheduledAt,
  outcome,
  outcomeAt,
  journeySeenAt,
  feeRequests: initial,
  onRefresh,
}: Props) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [feeRequests, setFeeRequests] = useState(initial)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const review = (requestId: string, status: 'APPROVED' | 'DENIED') => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/rbts/${rbtProfileId}/exam-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            status,
            adminNote: notes[requestId] || undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(data.error || 'Failed', 'error')
          return
        }
        setFeeRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status,
                  adminNote: notes[requestId] || null,
                  reviewedAt: new Date().toISOString(),
                }
              : r
          )
        )
        showToast(`Fee request ${status.toLowerCase()}`, 'success')
        onRefresh?.()
      } catch {
        showToast('Failed to review', 'error')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-semibold text-ink">Exam status</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-quiet">Journey page seen</dt>
            <dd className="font-medium">{fmt(journeySeenAt)}</dd>
          </div>
          <div>
            <dt className="text-quiet">Scheduled exam</dt>
            <dd className="font-medium">{fmt(scheduledAt)}</dd>
          </div>
          <div>
            <dt className="text-quiet">Result</dt>
            <dd className="font-medium">{outcome ?? 'Not reported'}</dd>
          </div>
          <div>
            <dt className="text-quiet">Result reported</dt>
            <dd className="font-medium">{fmt(outcomeAt)}</dd>
          </div>
        </dl>
        <a
          href={PEARSON_VUE_BACB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-[var(--sunrise)] hover:underline"
        >
          Pearson VUE BACB scheduling →
        </a>
        <p className="mt-2 text-xs text-quiet">
          Cancellation / no-show fees are never covered by the agency.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-semibold text-ink">Exam fee coverage requests</h3>
        {feeRequests.length === 0 ? (
          <p className="mt-2 text-sm text-quiet">No fee requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {feeRequests.map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {fmt(r.createdAt)} ·{' '}
                    <span
                      className={
                        r.status === 'APPROVED'
                          ? 'text-emerald-700'
                          : r.status === 'DENIED'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }
                    >
                      {r.status}
                    </span>
                  </span>
                </div>
                {r.note ? (
                  <p className="mt-1 text-sm text-quiet">RBT note: {r.note}</p>
                ) : null}
                {r.adminNote ? (
                  <p className="mt-1 text-sm text-quiet">Admin: {r.adminNote}</p>
                ) : null}
                {r.status === 'PENDING' ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Admin note (optional)"
                      value={notes[r.id] ?? ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => review(r.id, 'APPROVED')}
                      >
                        Approve fee
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => review(r.id, 'DENIED')}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
