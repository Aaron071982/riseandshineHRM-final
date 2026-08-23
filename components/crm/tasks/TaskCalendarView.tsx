'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TeamTaskPriority } from '@prisma/client'
import {
  TASK_PRIORITY_CALENDAR,
  TASK_STATUS_LABELS,
  isTaskOverdue,
} from '@/lib/crm/tasks/constants'
import type { TaskListItem } from '@/components/crm/tasks/TasksHubClient'
import { cn } from '@/lib/utils'

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function TaskCalendarView({
  tasks,
  onSelect,
}: {
  tasks: TaskListItem[]
  onSelect: (taskId: string) => void
}) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const monthStart = startOfMonth(viewMonth)
  const totalDays = daysInMonth(viewMonth)
  const startWeekday = monthStart.getDay()

  const byDay = useMemo(() => {
    const map = new Map<number, TaskListItem[]>()
    for (const t of tasks) {
      if (!t.dueAt) continue
      const d = new Date(t.dueAt)
      if (
        d.getMonth() !== viewMonth.getMonth() ||
        d.getFullYear() !== viewMonth.getFullYear()
      ) {
        continue
      }
      const day = d.getDate()
      const list = map.get(day) ?? []
      list.push(t)
      map.set(day, list)
    }
    return map
  }, [tasks, viewMonth])

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = viewMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const shiftMonth = (delta: number) => {
    setViewMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() + delta, 1)
    )
  }

  const dueThisMonth = tasks.filter((t) => {
    if (!t.dueAt) return false
    const d = new Date(t.dueAt)
    return (
      d.getMonth() === viewMonth.getMonth() &&
      d.getFullYear() === viewMonth.getFullYear()
    )
  })

  return (
    <div className="crm-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-[var(--sunrise-soft)]/60 to-surface px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{monthLabel}</h2>
          <p className="text-xs text-quiet tabular-nums">
            {dueThisMonth.length} task{dueThisMonth.length === 1 ? '' : 's'} due
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-quiet transition hover:bg-line-2 hover:text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="h-8 rounded-lg px-3 text-xs font-medium text-[var(--brand)] hover:bg-[var(--sunrise-soft)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-quiet transition hover:bg-line-2 hover:text-ink"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-faint">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (day == null) {
              return <div key={`e-${i}`} className="min-h-[88px]" />
            }
            const dayTasks = byDay.get(day) ?? []
            const isToday =
              day === today.getDate() &&
              viewMonth.getMonth() === today.getMonth() &&
              viewMonth.getFullYear() === today.getFullYear()
            return (
              <div
                key={day}
                className={cn(
                  'min-h-[88px] rounded-xl border p-1.5 transition-colors',
                  isToday
                    ? 'border-[var(--brand)] bg-gradient-to-b from-[var(--sunrise-soft)] to-surface shadow-sm ring-1 ring-[var(--brand)]/20'
                    : 'border-line/70 bg-[var(--bg)]/50 hover:border-line'
                )}
              >
                <div
                  className={cn(
                    'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                    isToday
                      ? 'sunrise-gradient text-white shadow-sm'
                      : 'text-quiet'
                  )}
                >
                  {day}
                </div>
                <ul className="space-y-0.5">
                  {dayTasks.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(t.id)}
                        className={cn(
                          'w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition hover:opacity-90',
                          isTaskOverdue(t.dueAt, t.status)
                            ? 'bg-[var(--urgent-bg)] text-[var(--urgent)] ring-1 ring-[var(--urgent)]/25'
                            : TASK_PRIORITY_CALENDAR[t.priority as TeamTaskPriority]
                        )}
                      >
                        {t.title}
                      </button>
                    </li>
                  ))}
                  {dayTasks.length > 4 && (
                    <li className="px-1 text-[10px] font-medium text-[var(--brand)]">
                      +{dayTasks.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {dueThisMonth.length > 0 && (
        <div className="border-t border-line bg-surface px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
            Upcoming this month
          </h3>
          <ul className="mt-2 space-y-1.5">
            {dueThisMonth.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="shrink-0 tabular-nums text-xs text-quiet">
                  {new Date(t.dueAt!).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="min-w-0 truncate font-medium text-ink hover:text-[var(--brand)] hover:underline"
                >
                  {t.title}
                </button>
                <span
                  className={cn(
                    'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    TASK_PRIORITY_CALENDAR[t.priority]
                  )}
                >
                  {TASK_STATUS_LABELS[t.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
