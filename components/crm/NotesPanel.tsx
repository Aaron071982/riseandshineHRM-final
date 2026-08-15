'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientPipelineStatus, CommChannel } from '@prisma/client'
import {
  addClientNote,
  logParentContact,
  setPipelineStatus,
} from '@/lib/crm/actions'
import { cn } from '@/lib/utils'

type Note = {
  id: string
  content: string
  createdAt: string | Date
  author: { id: string; name: string | null; email: string | null }
}

export function NotesPanel({
  clientId,
  notes,
  pipelineStatus,
  lastParentContactAt,
  canEdit,
}: {
  clientId: string
  notes: Note[]
  pipelineStatus: ClientPipelineStatus
  lastParentContactAt: string | Date | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [contactNote, setContactNote] = useState('')
  const [channel, setChannel] = useState<CommChannel>('PHONE')
  const [pipeline, setPipeline] = useState(pipelineStatus)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  useEffect(() => {
    setPipeline(pipelineStatus)
  }, [pipelineStatus])

  const submitNote = () => {
    if (!content.trim()) return
    startTransition(async () => {
      setError('')
      const res = await addClientNote(clientId, content)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setContent('')
      router.refresh()
    })
  }

  const submitContact = () => {
    startTransition(async () => {
      setError('')
      const res = await logParentContact(clientId, {
        channel,
        note: contactNote,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setContactNote('')
      router.refresh()
    })
  }

  const submitPipeline = () => {
    startTransition(async () => {
      setError('')
      const res = await setPipelineStatus(clientId, pipeline, reason)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setReason('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">Pipeline status</h3>
        <p className="mt-0.5 text-sm text-quiet">
          On hold / discharge does not reset the journey stage.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select
            value={pipeline}
            disabled={!canEdit || pending}
            onChange={(e) => setPipeline(e.target.value as ClientPipelineStatus)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          >
            {(['LIVE', 'ON_HOLD', 'DISCHARGED', 'LOST'] as const).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <input
            value={reason}
            disabled={!canEdit || pending}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            className="h-9 min-w-[12rem] flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          />
          {canEdit && (
            <button
              type="button"
              disabled={pending || pipeline === pipelineStatus}
              onClick={submitPipeline}
              className="h-9 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Update status
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">Log parent contact</h3>
        <p className="mt-0.5 text-sm text-quiet">
          Last contact:{' '}
          {lastParentContactAt
            ? new Date(lastParentContactAt).toLocaleString()
            : 'Never recorded'}
        </p>
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CommChannel)}
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            >
              <option value="PHONE">Phone</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
            <input
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="Brief note (optional)"
              className="h-9 min-w-[12rem] flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
            <button
              type="button"
              disabled={pending}
              onClick={submitContact}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2"
            >
              Log contact
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-semibold text-ink">Notes & updates</h3>
        {canEdit && (
          <div className="mt-3 rounded-xl border border-line bg-surface p-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Add an update for the care team…"
              className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={pending || !content.trim()}
                onClick={submitNote}
                className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
              >
                Add note
              </button>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {notes.length === 0 && (
            <li className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-quiet">
              No notes yet — capture the first update above.
            </li>
          )}
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-quiet">
                <span className="font-medium text-ink">
                  {n.author.name || n.author.email || 'User'}
                </span>
                <time className="tabular-nums">
                  {new Date(n.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{n.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function OverviewPanel({
  client,
}: {
  client: {
    firstName: string
    lastName: string
    clientCode: string
    dateOfBirth: string | Date | null
    addressLine: string | null
    city: string | null
    borough: string | null
    state: string | null
    zip: string | null
    insuranceProvider: string | null
    insuranceId: string | null
    diagnosis: string | null
    parentName: string | null
    parentPhone: string | null
    parentEmail: string | null
    parentRelationship: string | null
    bcbaName: string | null
    caseCoordinatorName: string | null
    bcbaProfile: { fullName: string; email: string | null } | null
    caseCoordinatorUser: { name: string | null; email: string | null } | null
    referralSource: string | null
    inquiryReceivedAt: string | Date | null
    actualServiceStartDate: string | Date | null
  }
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Client code', value: client.clientCode },
    {
      label: 'Date of birth',
      value: client.dateOfBirth
        ? new Date(client.dateOfBirth).toLocaleDateString()
        : '—',
    },
    {
      label: 'Address',
      value:
        [client.addressLine, client.city, client.borough, client.state, client.zip]
          .filter(Boolean)
          .join(', ') || '—',
    },
    { label: 'Insurance', value: client.insuranceProvider || '—' },
    { label: 'Member ID', value: client.insuranceId || '—' },
    { label: 'Diagnosis', value: client.diagnosis || '—' },
    { label: 'Parent', value: client.parentName || '—' },
    { label: 'Parent phone', value: client.parentPhone || '—' },
    { label: 'Parent email', value: client.parentEmail || '—' },
    { label: 'Relationship', value: client.parentRelationship || '—' },
    {
      label: 'BCBA',
      value: client.bcbaProfile?.fullName || client.bcbaName || '—',
    },
    {
      label: 'Case coordinator',
      value:
        client.caseCoordinatorUser?.name ||
        client.caseCoordinatorUser?.email ||
        client.caseCoordinatorName ||
        '—',
    },
    { label: 'Referral source', value: client.referralSource || '—' },
    {
      label: 'Inquiry received',
      value: client.inquiryReceivedAt
        ? new Date(client.inquiryReceivedAt).toLocaleDateString()
        : '—',
    },
    {
      label: 'Actual start',
      value: client.actualServiceStartDate
        ? new Date(client.actualServiceStartDate).toLocaleDateString()
        : '—',
    },
  ]

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">
            {r.label}
          </dt>
          <dd
            className={cn(
              'mt-0.5 text-sm text-ink',
              r.label.includes('phone') && 'tabular-nums'
            )}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
