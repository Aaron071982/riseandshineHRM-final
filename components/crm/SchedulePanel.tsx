'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addScheduleEntries,
  removeScheduleEntry,
  searchRbtProfiles,
} from '@/lib/crm/actions'
import { ProfilePicker } from '@/components/crm/ProfilePicker'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import { DAY_LABELS, formatTime12h, hoursBetween } from '@/lib/rbt-schedule/utils'
import { cn } from '@/lib/utils'

type Slot = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string | null
  periodStart: string | Date | null
  periodEnd: string | Date | null
  rbtProfileId: string
  billabilityStatus?: 'COVERED' | 'NOT_COVERED' | 'UNKNOWN'
  billabilityReason?: string | null
  rbtProfile: { id: string; firstName: string; lastName: string }
}

export function SchedulePanel({
  clientId,
  slots,
  weeklyHours,
  authHours,
  assignedRbtIds,
  canEdit,
}: {
  clientId: string
  slots: Slot[]
  weeklyHours: number
  authHours: number | null
  assignedRbtIds: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [form, setForm] = useState({
    rbtProfileId: assignedRbtIds[0] ?? '',
    rbtName: '',
    days: [1] as number[],
    startTime: '09:00',
    endTime: '12:00',
    location: 'Home',
  })
  const [overrides, setOverrides] = useState<
    Record<number, { startTime: string; endTime: string }>
  >({})
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  const searchRbt = useCallback(async (q: string) => {
    const res = await searchRbtProfiles(q)
    if (!res.ok) return { ok: false as const, error: res.error }
    return { ok: true as const, results: res.results }
  }, [])

  const delta =
    authHours != null ? Math.round((weeklyHours - authHours) * 10) / 10 : null

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}
      {warn && (
        <p className="rounded-lg border border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_12%,white)] px-3 py-2 text-sm text-[var(--amber)]">
          {warn}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Weekly scheduled"
          value={`${weeklyHours.toFixed(1)} hrs`}
        />
        <Stat
          label="Authorized weekly"
          value={authHours != null ? `${authHours} hrs` : '—'}
        />
        <Stat
          label="Variance"
          value={
            delta == null
              ? '—'
              : delta === 0
                ? 'On target'
                : delta > 0
                  ? `+${delta} over`
                  : `${delta} under`
          }
          tone={
            delta == null
              ? 'neutral'
              : Math.abs(delta) < 0.5
                ? 'good'
                : delta > 0
                  ? 'warn'
                  : 'info'
          }
        />
      </div>

      {canEdit && (
        <div className="grid gap-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-1 text-xs text-quiet">RBT</p>
            <ProfilePicker
              mode="rbt"
              valueId={form.rbtProfileId || null}
              valueLabel={form.rbtName || null}
              searchFn={searchRbt}
              placeholder="Search assigned / available RBTs…"
              disabled={pending}
              onSelect={(id, name) =>
                setForm((f) => ({
                  ...f,
                  rbtProfileId: id ?? '',
                  rbtName: name ?? '',
                }))
              }
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-1 text-xs text-quiet">Days</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, i) => {
                const on = form.days.includes(i)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        days: on
                          ? f.days.filter((d) => d !== i)
                          : [...f.days, i].sort(),
                      }))
                    }
                    className={cn(
                      'h-8 rounded-lg border px-2.5 text-xs font-medium',
                      on
                        ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-brand'
                        : 'border-line text-quiet hover:text-ink'
                    )}
                  >
                    {label.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="text-xs text-quiet">
            Start (all selected)
            <input
              type="time"
              value={form.startTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, startTime: e.target.value }))
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm tabular-nums focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          </label>
          <label className="text-xs text-quiet">
            End (all selected)
            <input
              type="time"
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm tabular-nums focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          </label>
          <label className="text-xs text-quiet sm:col-span-2 lg:col-span-1">
            Location
            <input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          </label>
          {form.days.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3 space-y-1">
              <p className="text-xs text-quiet">Per-day time override (optional)</p>
              {form.days.map((d) => {
                const open = expandedDay === d
                const ov = overrides[d]
                return (
                  <div key={d} className="rounded-lg border border-line px-2 py-1.5">
                    <button
                      type="button"
                      className="text-xs font-medium text-brand"
                      onClick={() => setExpandedDay(open ? null : d)}
                    >
                      {open ? 'Hide' : 'Override'} {DAY_LABELS[d]}
                      {ov ? ` (${ov.startTime}–${ov.endTime})` : ''}
                    </button>
                    {open && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="time"
                          value={ov?.startTime ?? form.startTime}
                          onChange={(e) =>
                            setOverrides((prev) => ({
                              ...prev,
                              [d]: {
                                startTime: e.target.value,
                                endTime: prev[d]?.endTime ?? form.endTime,
                              },
                            }))
                          }
                          className="h-8 rounded-lg border border-line px-2 text-sm tabular-nums"
                        />
                        <input
                          type="time"
                          value={ov?.endTime ?? form.endTime}
                          onChange={(e) =>
                            setOverrides((prev) => ({
                              ...prev,
                              [d]: {
                                startTime: prev[d]?.startTime ?? form.startTime,
                                endTime: e.target.value,
                              },
                            }))
                          }
                          className="h-8 rounded-lg border border-line px-2 text-sm tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              disabled={pending || !form.rbtProfileId || form.days.length === 0}
              onClick={() => {
                startTransition(async () => {
                  setError('')
                  setWarn('')
                  const res = await addScheduleEntries(clientId, {
                    rbtProfileId: form.rbtProfileId,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    location: form.location,
                    days: form.days.map((dayOfWeek) => ({
                      dayOfWeek,
                      startTime: overrides[dayOfWeek]?.startTime,
                      endTime: overrides[dayOfWeek]?.endTime,
                    })),
                  })
                  if (!res.ok) setError(res.error)
                  else if (res.warning) setWarn(res.warning)
                  router.refresh()
                })
              }}
              className="h-9 w-full rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Add {form.days.length || 0} session{form.days.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-display text-base font-semibold text-ink">
            No schedule yet
          </p>
          <p className="mt-1 text-sm text-quiet">
            Add day, time, location, and an RBT to confirm the weekly plan.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {slots.map((s) => {
            const hrs = hoursBetween(s.startTime, s.endTime)
            const rbtName = `${s.rbtProfile.firstName} ${s.rbtProfile.lastName}`.trim()
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-[7rem]">
                  <div className="text-sm font-medium text-ink">
                    {DAY_LABELS[s.dayOfWeek] ?? `Day ${s.dayOfWeek}`}
                  </div>
                  <div className="text-xs tabular-nums text-quiet">
                    {formatTime12h(s.startTime)} – {formatTime12h(s.endTime)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{rbtName}</div>
                  <div className="text-xs text-quiet">
                    {s.location || 'No location'}
                    {s.periodStart && s.periodEnd
                      ? ` · ${new Date(s.periodStart).toLocaleDateString()}–${new Date(s.periodEnd).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
                <span className="text-sm tabular-nums text-quiet">
                  {hrs.toFixed(1)}h
                </span>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-medium',
                    s.billabilityStatus === 'COVERED' &&
                      'bg-[color-mix(in_srgb,var(--green)_14%,white)] text-[var(--green)]',
                    s.billabilityStatus === 'NOT_COVERED' &&
                      'bg-[var(--urgent-bg)] text-[var(--urgent)]',
                    (!s.billabilityStatus || s.billabilityStatus === 'UNKNOWN') &&
                      'bg-line-2 text-quiet'
                  )}
                  title={s.billabilityReason ?? 'Billability check pending'}
                >
                  {s.billabilityStatus === 'COVERED'
                    ? 'Billable'
                    : s.billabilityStatus === 'NOT_COVERED'
                      ? 'Not billable'
                      : 'Billability unknown'}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setRemoveId(s.id)}
                    className="text-xs text-[var(--urgent)] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDestructiveDialog
        open={!!removeId}
        onOpenChange={(o) => {
          if (!o) setRemoveId(null)
        }}
        title="Remove this schedule entry?"
        description={(() => {
          const s = slots.find((x) => x.id === removeId)
          if (!s) return 'This schedule entry will be soft-deleted and hidden from the family record. An audit log is written.'
          const rbt = `${s.rbtProfile.firstName} ${s.rbtProfile.lastName}`.trim()
          return `Remove ${DAY_LABELS[s.dayOfWeek] ?? 'session'} ${s.startTime}–${s.endTime} with ${rbt} from this family.\n\nThe row is soft-deleted (not destroyed) and an audit log is written.`
        })()}
        confirmLabel="Remove schedule"
        pending={pending}
        onConfirm={() => {
          if (!removeId) return
          startTransition(async () => {
            await removeScheduleEntry(removeId)
            setRemoveId(null)
            router.refresh()
          })
        }}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'warn' | 'info'
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 font-display text-lg font-semibold tabular-nums',
          tone === 'good' && 'text-[var(--green)]',
          tone === 'warn' && 'text-[var(--amber)]',
          tone === 'info' && 'text-[var(--blue)]',
          tone === 'neutral' && 'text-ink'
        )}
      >
        {value}
      </div>
    </div>
  )
}
