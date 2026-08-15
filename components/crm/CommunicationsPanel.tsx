'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  CommChannel,
  CommDirection,
  CommTemplate,
} from '@prisma/client'
import { logCommunication } from '@/lib/crm/actions'
import { cn } from '@/lib/utils'

const TEMPLATES: { value: CommTemplate; label: string }[] = [
  { value: 'INQUIRY_ACK', label: 'Inquiry acknowledgment' },
  { value: 'CONSENT_REQUEST', label: 'Consent request' },
  { value: 'DOCS_NEEDED', label: 'Documents needed' },
  { value: 'BENEFITS_UPDATE', label: 'Benefits update' },
  { value: 'ASSESSMENT_SCHEDULED', label: 'Assessment scheduled' },
  { value: 'AUTH_APPROVED', label: 'Auth approved' },
  { value: 'READY_FOR_STAFFING', label: 'Ready for staffing' },
  { value: 'RBT_ASSIGNED', label: 'RBT assigned' },
  { value: 'SCHEDULE_CONFIRMED', label: 'Schedule confirmed' },
  { value: 'SERVICES_STARTED', label: 'Services started' },
  { value: 'MANUAL', label: 'Manual / freeform' },
]

type Comm = {
  id: string
  template: CommTemplate
  channel: CommChannel
  direction: CommDirection
  subject: string | null
  body: string | null
  sentAt: string | Date
  status: string | null
  sentByUser: { id: string; name: string | null; email: string | null } | null
}

export function CommunicationsPanel({
  clientId,
  communications,
  canEdit,
}: {
  clientId: string
  communications: Comm[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    template: 'MANUAL' as CommTemplate,
    channel: 'PHONE' as CommChannel,
    direction: 'OUTBOUND' as CommDirection,
    subject: '',
    body: '',
  })

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <p className="text-sm text-quiet">
        Parent-journey emails send automatically on stage advances when
        enabled in env. With sends off, the timeline still records SKIPPED
        rows so you can see what would have gone out.
      </p>

      {canEdit && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="font-display text-base font-semibold text-ink">
            Log communication
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-quiet">
              Template
              <select
                value={form.template}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    template: e.target.value as CommTemplate,
                  }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-quiet">
              Channel
              <select
                value={form.channel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    channel: e.target.value as CommChannel,
                  }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
              >
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone</option>
                <option value="SMS">SMS</option>
              </select>
            </label>
            <label className="text-xs text-quiet">
              Direction
              <select
                value={form.direction}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    direction: e.target.value as CommDirection,
                  }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
              >
                <option value="OUTBOUND">Outbound</option>
                <option value="INBOUND">Inbound</option>
              </select>
            </label>
            <label className="text-xs text-quiet sm:col-span-3">
              Subject
              <input
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
              />
            </label>
            <label className="text-xs text-quiet sm:col-span-3">
              Body / notes
              <textarea
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={3}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  setError('')
                  const res = await logCommunication(clientId, form)
                  if (!res.ok) {
                    setError(res.error)
                    return
                  }
                  setForm((f) => ({ ...f, subject: '', body: '' }))
                  router.refresh()
                })
              }}
              className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Record communication
            </button>
          </div>
        </div>
      )}

      {communications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-display text-base font-semibold text-ink">
            No communications yet
          </p>
          <p className="mt-1 text-sm text-quiet">
            Logged contacts and journey templates will appear in this timeline.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {communications.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {TEMPLATES.find((t) => t.value === c.template)?.label ??
                      c.template}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                      c.direction === 'OUTBOUND'
                        ? 'bg-[var(--blue-bg)] text-[var(--blue)]'
                        : 'bg-[var(--green-bg)] text-[var(--green)]'
                    )}
                  >
                    {c.direction} · {c.channel}
                  </span>
                </div>
                <time className="text-xs tabular-nums text-quiet">
                  {new Date(c.sentAt).toLocaleString()}
                </time>
              </div>
              {c.subject && (
                <p className="mt-1 text-sm text-ink">{c.subject}</p>
              )}
              {c.body && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-quiet">
                  {c.body}
                </p>
              )}
              <p className="mt-1 text-xs text-faint">
                {c.sentByUser?.name || c.sentByUser?.email || 'System'}
                {c.status ? ` · ${c.status}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
