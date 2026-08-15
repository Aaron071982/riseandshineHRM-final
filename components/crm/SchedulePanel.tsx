'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addScheduleEntry,
  removeScheduleEntry,
  searchRbtProfiles,
} from '@/lib/crm/actions'
import { ProfilePicker } from '@/components/crm/ProfilePicker'
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
  const [form, setForm] = useState({
    rbtProfileId: assignedRbtIds[0] ?? '',
    rbtName: '',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '12:00',
    location: 'Home',
  })

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
          <label className="text-xs text-quiet">
            Day
            <select
              value={form.dayOfWeek}
              onChange={(e) =>
                setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-quiet">
            Start
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
            End
            <input
              type="time"
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm tabular-nums focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          </label>
          <label className="text-xs text-quiet sm:col-span-2">
            Location
            <input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending || !form.rbtProfileId}
              onClick={() => {
                startTransition(async () => {
                  setError('')
                  const res = await addScheduleEntry(clientId, {
                    rbtProfileId: form.rbtProfileId,
                    dayOfWeek: form.dayOfWeek,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    location: form.location,
                  })
                  if (!res.ok) setError(res.error)
                  router.refresh()
                })
              }}
              className="h-9 w-full rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Add session
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
                {canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await removeScheduleEntry(s.id)
                        router.refresh()
                      })
                    }}
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
