'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatHours } from '@/lib/billing/format'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import SessionStatusBadge from '@/components/billing/SessionStatusBadge'
import { cn } from '@/lib/utils'

function formatWindow(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  if (!start || !end) return '—'
  const s = typeof start === 'string' ? new Date(start) : start
  const e = typeof end === 'string' ? new Date(end) : end
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return '—'
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${s.toLocaleTimeString('en-US', opts)} – ${e.toLocaleTimeString('en-US', opts)}`
}

export type DrilldownSession = {
  id: string
  clientName: string
  dos: string
  actualMinutes: number
  rawActualMinutes?: number | null
  clampedPayableMinutes?: number | null
  clampApplied?: boolean | null
  reviewFlag?: string | null
  scheduledStart?: string | Date | null
  scheduledEnd?: string | Date | null
  actualStart?: string | Date | null
  actualEnd?: string | Date | null
  procedureCode: string | null
  location: string | null
  sessionStatus: string | null
}

export default function SessionDrilldown({ sessions }: { sessions: DrilldownSession[] }) {
  const [open, setOpen] = useState(false)

  if (sessions.length === 0) return null

  const flagged = sessions.filter((s) => s.reviewFlag).length
  const variance = sessions.filter((s) => {
    const raw = s.rawActualMinutes ?? s.actualMinutes
    return Math.abs(raw - s.actualMinutes) > 0.01
  }).length

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[#0D9488] font-medium"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        {variance > 0 && (
          <span className="ml-1 text-amber-700 dark:text-amber-300">
            · {variance} actual ≠ appointed
          </span>
        )}
        {flagged > 0 && (
          <span className="ml-1 text-red-700 dark:text-red-300">· {flagged} need review</span>
        )}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded border border-gray-200 dark:border-[var(--border-subtle)]">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 dark:bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Client</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Appointed</th>
                <th className="px-2 py-1 text-left">Actual stay</th>
                <th className="px-2 py-1 text-right">Stay hrs</th>
                <th className="px-2 py-1 text-right">Payable (appointed)</th>
                <th className="px-2 py-1 text-left">Note</th>
                <th className="px-2 py-1 text-left">Flag</th>
                <th className="px-2 py-1 text-left">Code</th>
                <th className="px-2 py-1 text-left">Location</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const raw = s.rawActualMinutes ?? s.actualMinutes
                const varianceMin = raw - s.actualMinutes
                const varianceRow = Math.abs(varianceMin) > 0.01
                const under = varianceMin < -0.01
                const over = varianceMin > 0.01
                const flaggedRow = !!s.reviewFlag
                const note =
                  under
                    ? `Under by ${formatHours(-varianceMin / 60)}`
                    : over
                      ? `Over by ${formatHours(varianceMin / 60)}`
                      : '—'
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-t border-gray-100 dark:border-[var(--border-subtle)]',
                      flaggedRow && 'bg-red-50 dark:bg-red-950/30',
                      !flaggedRow && varianceRow && 'bg-amber-50/80 dark:bg-amber-950/20'
                    )}
                  >
                    <td className="px-2 py-1 whitespace-nowrap">{formatCalendarDate(s.dos)}</td>
                    <td className="px-2 py-1">{s.clientName}</td>
                    <td className="px-2 py-1">
                      <SessionStatusBadge status={s.sessionStatus} />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {formatWindow(s.scheduledStart, s.scheduledEnd)}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {formatWindow(s.actualStart, s.actualEnd)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatHours(raw / 60)}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-medium text-[#0D9488]">
                      {formatHours(s.actualMinutes / 60)}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-1',
                        under && 'text-amber-800 dark:text-amber-200',
                        over && 'text-sky-800 dark:text-sky-200'
                      )}
                    >
                      {note}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-1 max-w-[10rem]',
                        flaggedRow && 'text-red-800 dark:text-red-200 font-medium'
                      )}
                    >
                      {s.reviewFlag ?? '—'}
                    </td>
                    <td className="px-2 py-1">{s.procedureCode ?? '—'}</td>
                    <td className="px-2 py-1">{s.location ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
