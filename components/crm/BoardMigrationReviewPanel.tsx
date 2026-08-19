'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  confirmBoardMigrationRow,
  discardBoardMigrationRow,
  listBoardMigrationReview,
} from '@/lib/crm/actions'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import { DAY_LABELS, formatTime12h } from '@/lib/rbt-schedule/utils'

type Row = {
  id: string
  clientName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string | null
  rbtName: string
  serviceClientId: string | null
  serviceClientLive: boolean | null
  conflict: boolean
}

export default function BoardMigrationReviewPanel() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [discardId, setDiscardId] = useState<string | null>(null)

  const load = () => {
    startTransition(async () => {
      const res = await listBoardMigrationReview()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError('')
      setRows(res.rows)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const target = rows.find((r) => r.id === discardId)

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-semibold text-ink">
        Board-slot migration review
      </h2>
      <p className="mt-0.5 text-sm text-quiet">
        Provisional rows copied from the old weekly board. Confirm to make them
        live; discard soft-deletes (nothing is hard-deleted).
      </p>
      {error && <p className="mt-2 text-sm text-[var(--urgent)]">{error}</p>}
      {rows.length === 0 && !pending ? (
        <p className="mt-3 text-sm text-quiet">No provisional board rows waiting.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <div className="text-sm font-medium text-ink">
                  {r.clientName}{' '}
                  <span className="font-normal text-quiet">· {r.rbtName}</span>
                </div>
                <div className="text-xs text-quiet">
                  {DAY_LABELS[r.dayOfWeek]} {formatTime12h(r.startTime)}–
                  {formatTime12h(r.endTime)}
                  {r.location ? ` · ${r.location}` : ''}
                  {r.serviceClientId
                    ? r.serviceClientLive
                      ? ' · linked LIVE client'
                      : ' · linked, not LIVE'
                    : ' · unmatched client'}
                  {r.conflict ? ' · conflict: other RBT already scheduled' : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-medium text-brand hover:underline"
                  onClick={() => {
                    startTransition(async () => {
                      const res = await confirmBoardMigrationRow(r.id)
                      if (!res.ok) setError(res.error)
                      else load()
                    })
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-medium text-[var(--urgent)] hover:underline"
                  onClick={() => setDiscardId(r.id)}
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDestructiveDialog
        open={!!discardId}
        onOpenChange={(o) => !o && setDiscardId(null)}
        title="Discard provisional session?"
        description={
          target
            ? `Soft-delete ${target.clientName} (${DAY_LABELS[target.dayOfWeek]} ${formatTime12h(target.startTime)}). This does not hard-delete.`
            : ''
        }
        confirmLabel="Discard"
        pending={pending}
        onConfirm={async () => {
          if (!discardId) return
          const res = await discardBoardMigrationRow(discardId)
          if (!res.ok) setError(res.error)
          setDiscardId(null)
          load()
        }}
      />
    </section>
  )
}
