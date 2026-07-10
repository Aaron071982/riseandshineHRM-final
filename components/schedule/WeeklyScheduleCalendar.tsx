'use client'

import {
  CALENDAR_DAY_ORDER,
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  DAY_SHORT,
  colorForClient,
  formatTime12h,
  parseTimeToMinutes,
  type ScheduleAssignmentDTO,
} from '@/lib/rbt-schedule/utils'

const HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, i) => CALENDAR_START_HOUR + i
)
const TOTAL_MINUTES = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60

type Props = {
  assignments: ScheduleAssignmentDTO[]
  readOnly?: boolean
  onBlockClick?: (assignment: ScheduleAssignmentDTO) => void
  onEmptyClick?: (dayOfWeek: number, startTime: string) => void
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function WeeklyScheduleCalendar({
  assignments,
  readOnly = false,
  onBlockClick,
  onEmptyClick,
}: Props) {
  const active = assignments.filter((a) => a.isActive !== false)

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)]">
      <div className="min-w-[720px]">
        {/* Header */}
        <div
          className="grid border-b border-gray-200 dark:border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
        >
          <div className="p-2 text-xs text-gray-400" />
          {CALENDAR_DAY_ORDER.map((d) => (
            <div
              key={d}
              className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-[var(--text-secondary)] border-l border-gray-100 dark:border-[var(--border-subtle)]"
            >
              {DAY_SHORT[d]}
            </div>
          ))}
        </div>

        {/* Body */}
        <div
          className="grid relative"
          style={{ gridTemplateColumns: '56px repeat(7, 1fr)', height: `${HOURS.length * 48}px` }}
        >
          {/* Time labels + hour lines */}
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 text-[10px] text-gray-400 pr-1 text-right"
                style={{ top: `${((h - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100}%` }}
              >
                {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </div>
            ))}
          </div>

          {CALENDAR_DAY_ORDER.map((day) => {
            const dayAssignments = active.filter((a) => a.dayOfWeek === day)
            return (
              <div
                key={day}
                className="relative border-l border-gray-100 dark:border-[var(--border-subtle)] cursor-pointer"
                onClick={(e) => {
                  if (readOnly || !onEmptyClick) return
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const ratio = clamp(y / rect.height, 0, 0.99)
                  const minsFromStart = Math.round((ratio * TOTAL_MINUTES) / 30) * 30
                  const hour = CALENDAR_START_HOUR + Math.floor(minsFromStart / 60)
                  const minute = minsFromStart % 60
                  const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                  onEmptyClick(day, startTime)
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-gray-50 dark:border-[var(--border-subtle)]/40"
                    style={{
                      top: `${((h - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100}%`,
                      height: `${100 / HOURS.length}%`,
                    }}
                  />
                ))}

                {dayAssignments.map((a) => {
                  const start = parseTimeToMinutes(a.startTime)
                  const end = parseTimeToMinutes(a.endTime)
                  if (start == null || end == null) return null
                  const calendarStart = CALENDAR_START_HOUR * 60
                  const topPct = ((start - calendarStart) / TOTAL_MINUTES) * 100
                  const heightPct = ((end - start) / TOTAL_MINUTES) * 100
                  if (heightPct <= 0) return null
                  const colors = colorForClient(a.clientName)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left shadow-sm transition hover:shadow-md ${colors.bg} ${colors.border} ${colors.text} ${
                        readOnly ? 'cursor-default' : 'cursor-pointer'
                      }`}
                      style={{
                        top: `${clamp(topPct, 0, 100)}%`,
                        height: `${clamp(heightPct, 3, 100 - topPct)}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onBlockClick?.(a)
                      }}
                      title={`${a.clientName} · ${formatTime12h(a.startTime)}–${formatTime12h(a.endTime)}${a.location ? ` · ${a.location}` : ''}`}
                    >
                      <div className="text-[11px] font-semibold leading-tight truncate">{a.clientName}</div>
                      <div className="text-[10px] opacity-80 leading-tight truncate">
                        {formatTime12h(a.startTime)}–{formatTime12h(a.endTime)}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
