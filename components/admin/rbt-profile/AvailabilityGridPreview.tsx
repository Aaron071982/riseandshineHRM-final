'use client'

/**
 * Visual grid: days (columns) × hour blocks (rows) from availabilityJson
 * (weekday/weekend booleans + earliest/latest times from the application wizard).
 */
export default function AvailabilityGridPreview({ availabilityJson }: { availabilityJson: unknown }) {
  const aj = availabilityJson as {
    weekday?: Record<string, boolean>
    weekend?: Record<string, boolean>
    earliestStartTime?: string
    latestEndTime?: string
  } | null

  const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
  const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const dayAvail = FULL.map((full) => {
    const isWeekend = full === 'Saturday' || full === 'Sunday'
    const map = isWeekend ? (aj?.weekend ?? {}) : (aj?.weekday ?? {})
    return map[full] === true
  })

  const hasAnyDay = dayAvail.some(Boolean)
  const showEmptyState = !aj || !hasAnyDay

  function parseTime(s: string | undefined): number | null {
    if (!s || typeof s !== 'string') return null
    const m = s.match(/^(\d{1,2}):(\d{2})/)
    if (!m) return null
    return parseInt(m[1], 10) + parseInt(m[2], 10) / 60
  }

  const start = parseTime(aj?.earliestStartTime) ?? 14
  const end = parseTime(aj?.latestEndTime) ?? 22
  const startH = Math.max(0, Math.min(23, Math.floor(start)))
  const endH = Math.max(startH + 1, Math.min(24, Math.ceil(end)))

  const hours: number[] = []
  for (let h = startH; h < endH; h++) hours.push(h)
  if (hours.length === 0) {
    for (let h = 14; h < 22; h++) hours.push(h)
  }

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hr = h % 12 === 0 ? 12 : h % 12
    return `${hr} ${ampm}`
  }

  /** Hour block [h, h+1) overlaps [start, end) and day is selected */
  const cellActive = (dayIndex: number, hour: number) => {
    if (!dayAvail[dayIndex]) return false
    const blockStart = hour
    const blockEnd = hour + 1
    return blockEnd > start && blockStart < end
  }

  return (
    <div className="space-y-2">
      {showEmptyState ? (
        <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">No availability on file.</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-primary)]">
        <table className="w-full text-[10px] sm:text-xs border-collapse table-fixed">
          <thead>
            <tr>
              <th className="border-b border-r border-gray-200 dark:border-[var(--border-subtle)] p-1 w-11 text-left font-normal text-gray-500">
                Time
              </th>
              {SHORT.map((d) => (
                <th
                  key={d}
                  className="border-b border-gray-200 dark:border-[var(--border-subtle)] p-1 font-semibold text-gray-700 dark:text-[var(--text-secondary)]"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border-r border-t border-gray-200 dark:border-[var(--border-subtle)] p-1 text-gray-500 whitespace-nowrap align-middle">
                  {formatHour(hour)}
                </td>
                {FULL.map((_, di) => (
                  <td
                    key={`${hour}-${di}`}
                    className={`border-t border-gray-200 dark:border-[var(--border-subtle)] p-0 h-6 ${
                      cellActive(di, hour)
                        ? 'bg-orange-200/90 dark:bg-[var(--orange-primary)]/35'
                        : 'bg-gray-100/50 dark:bg-[var(--bg-elevated)]'
                    }`}
                    title={cellActive(di, hour) ? 'Available' : dayAvail[di] ? 'Outside time range' : 'Not selected'}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
        Window:{' '}
        <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">{aj?.earliestStartTime || '—'}</span>
        {' — '}
        <span className="font-medium text-gray-700 dark:text-[var(--text-secondary)]">{aj?.latestEndTime || '—'}</span>
      </p>
    </div>
  )
}
