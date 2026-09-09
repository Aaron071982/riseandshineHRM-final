'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type {
  AttendanceEventDto,
  AttendanceVisit,
} from '@/lib/crm/clientAttendance'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import { cn } from '@/lib/utils'

const ESPRESSO = '#2A2019'
const SUNRISE = '#E7692C'
const SIGNED_IN = '#2E7D5B'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

function signatureSrc(data: string | null | undefined): string | null {
  if (!data) return null
  if (data.startsWith('data:')) return data
  return `data:image/png;base64,${data}`
}

export default function CheckInsPanel({
  clientId,
  firstName,
  canEdit,
}: {
  clientId: string
  firstName: string
  canEdit: boolean
}) {
  const [view, setView] = useState<'visits' | 'audit'>('visits')
  const [visits, setVisits] = useState<AttendanceVisit[]>([])
  const [events, setEvents] = useState<AttendanceEventDto[]>([])
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [sigModal, setSigModal] = useState<AttendanceEventDto | null>(null)
  const [voidTarget, setVoidTarget] = useState<AttendanceEventDto | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, startVoid] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      setError('')
      const res = await fetch(`/api/service-clients/${clientId}/attendance`, {
        credentials: 'include',
      })
      if (res.status === 401) {
        setError('Session expired — refresh to re-verify')
        return
      }
      if (!res.ok) {
        setError('Failed to load check-ins')
        return
      }
      const data = await res.json()
      setVisits(data.visits ?? [])
      setEvents(data.events ?? [])
    })
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = () => {
    const header = [
      'date',
      'start',
      'end',
      'durationMinutes',
      'status',
      'signedBy',
      'relationship',
    ]
    const lines = [header.join(',')]
    for (const v of visits) {
      const status = v.orphanOut ? 'orphan_out' : v.open ? 'signed_in' : 'complete'
      lines.push(
        [
          JSON.stringify(v.dateLabel),
          v.startedAt,
          v.endedAt ?? '',
          v.durationMinutes ?? '',
          status,
          JSON.stringify(v.signedByName),
          JSON.stringify(v.signedByRelationship),
        ].join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `check-ins-${firstName.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onVoid = () => {
    if (!voidTarget || !voidReason.trim()) return
    startVoid(async () => {
      setError('')
      const res = await fetch(
        `/api/service-clients/${clientId}/attendance/${voidTarget.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voidReason: voidReason.trim() }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Void failed')
        return
      }
      setVoidTarget(null)
      setVoidReason('')
      load()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            className="font-display text-base font-semibold"
            style={{ color: ESPRESSO }}
          >
            Check-ins
          </h3>
          <p className="mt-0.5 text-sm text-quiet">
            Front-desk kiosk sign-ins for this family.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setView('visits')}
              className={cn(
                'h-8 rounded-md px-3 text-sm font-medium',
                view === 'visits'
                  ? 'text-white'
                  : 'text-quiet hover:text-ink'
              )}
              style={
                view === 'visits' ? { backgroundColor: ESPRESSO } : undefined
              }
            >
              Visits
            </button>
            <button
              type="button"
              onClick={() => setView('audit')}
              className={cn(
                'h-8 rounded-md px-3 text-sm font-medium',
                view === 'audit'
                  ? 'text-white'
                  : 'text-quiet hover:text-ink'
              )}
              style={
                view === 'audit' ? { backgroundColor: ESPRESSO } : undefined
              }
            >
              Audit
            </button>
          </div>
          {visits.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="h-8 rounded-lg border border-line bg-surface px-3 text-sm text-ink hover:bg-line-2"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      {pending && visits.length === 0 && events.length === 0 ? (
        <p className="text-sm text-quiet">Loading check-ins…</p>
      ) : view === 'visits' ? (
        visits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-12 text-center">
            <p className="font-display text-base font-semibold" style={{ color: ESPRESSO }}>
              No check-ins yet
            </p>
            <p className="mt-1 text-sm text-quiet">
              Front-desk sign-ins for {firstName} will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visits.map((v) => {
              const sigEvent = v.inEvent ?? v.outEvent
              const thumb = signatureSrc(sigEvent?.signatureImageData)
              return (
                <li
                  key={v.id}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p
                        className="font-display text-sm font-semibold"
                        style={{ color: ESPRESSO }}
                      >
                        {v.dateLabel}
                      </p>
                      <p
                        className="mt-1 font-display text-lg font-semibold tabular-nums"
                        style={{ color: ESPRESSO }}
                      >
                        {v.orphanOut ? (
                          <>
                            — → {formatTime(v.endedAt!)}
                            <span className="ml-2 inline-flex rounded-md bg-[var(--amber-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--amber)]">
                              Orphan OUT
                            </span>
                          </>
                        ) : (
                          <>
                            {formatTime(v.startedAt)}
                            {v.open ? (
                              <span
                                className="ml-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                                style={{ backgroundColor: SIGNED_IN }}
                              >
                                Signed in
                              </span>
                            ) : (
                              <>
                                {' '}
                                → {formatTime(v.endedAt!)}
                                {v.durationMinutes != null && (
                                  <span
                                    className="ml-2 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                                    style={{ backgroundColor: SIGNED_IN }}
                                  >
                                    {formatDuration(v.durationMinutes)}
                                  </span>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-quiet">
                        Signed in by {v.signedByName} · {v.signedByRelationship}
                      </p>
                    </div>
                    {thumb && sigEvent && (
                      <button
                        type="button"
                        onClick={() => setSigModal(sigEvent)}
                        className="shrink-0 overflow-hidden rounded-lg border border-line bg-white"
                        title="View signature"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt="Signature"
                          className="h-14 w-28 object-contain"
                        />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-12 text-center">
          <p className="font-display text-base font-semibold" style={{ color: ESPRESSO }}>
            No check-ins yet
          </p>
          <p className="mt-1 text-sm text-quiet">
            Front-desk sign-ins for {firstName} will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Signer</th>
                <th className="px-3 py-2 font-medium">Relationship</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Hash</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {canEdit && <th className="px-3 py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {[...events].reverse().map((e) => (
                <tr key={e.id} className="border-b border-line-2">
                  <td className="px-3 py-2 font-display tabular-nums text-ink">
                    {new Date(e.eventAt).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold text-white"
                      style={{
                        backgroundColor:
                          e.eventType === 'IN' ? SIGNED_IN : SUNRISE,
                      }}
                    >
                      {e.eventType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink">{e.signedByName}</td>
                  <td className="px-3 py-2 text-quiet">{e.signedByRelationship}</td>
                  <td className="px-3 py-2 text-quiet">
                    {e.locationLabel || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="font-mono text-xs text-quiet hover:text-ink"
                      title="Copy hash"
                      onClick={() =>
                        void navigator.clipboard.writeText(e.signatureHash)
                      }
                    >
                      {e.signatureHash.slice(0, 10)}…
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {e.voidedAt ? (
                      <span className="rounded-md bg-[var(--urgent-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--urgent)]">
                        Voided
                      </span>
                    ) : (
                      <span className="text-xs text-quiet">Live</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      {!e.voidedAt && (
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--urgent)] hover:underline"
                          onClick={() => {
                            setVoidReason('')
                            setVoidTarget(e)
                          }}
                        >
                          Void
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sigModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSigModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h4
                className="font-display text-lg font-semibold"
                style={{ color: ESPRESSO }}
              >
                Signature
              </h4>
              <button
                type="button"
                className="text-sm text-quiet hover:text-ink"
                onClick={() => setSigModal(null)}
              >
                Close
              </button>
            </div>
            {signatureSrc(sigModal.signatureImageData) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureSrc(sigModal.signatureImageData)!}
                alt="Full signature"
                className="mt-3 w-full rounded-lg border border-line bg-white object-contain"
              />
            )}
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-quiet">When</dt>
                <dd className="font-display tabular-nums text-ink">
                  {new Date(sigModal.eventAt).toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-quiet">Hash</dt>
                <dd className="break-all font-mono text-xs text-ink">
                  {sigModal.signatureHash}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-quiet">IP</dt>
                <dd className="text-ink">{sigModal.signatureIpAddress || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-quiet">Device</dt>
                <dd className="font-mono text-xs text-ink">
                  {sigModal.kioskDeviceId || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-quiet">Location</dt>
                <dd className="text-ink">{sigModal.locationLabel || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <ConfirmDestructiveDialog
        open={!!voidTarget}
        onOpenChange={(o) => {
          if (!o) {
            setVoidTarget(null)
            setVoidReason('')
          }
        }}
        title="Void this check-in event?"
        description="The row stays in the audit trail with a Voided badge. Only void fields change — the append-only trigger blocks other edits."
        confirmLabel="Void event"
        pending={voiding}
        confirmDisabled={!voidReason.trim()}
        onConfirm={onVoid}
      >
        <div className="space-y-2">
          <label
            htmlFor="void-attendance-reason"
            className="block text-sm font-medium text-ink"
          >
            Reason
          </label>
          <textarea
            id="void-attendance-reason"
            rows={3}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            placeholder="Why is this event being voided?"
          />
        </div>
      </ConfirmDestructiveDialog>
    </div>
  )
}
