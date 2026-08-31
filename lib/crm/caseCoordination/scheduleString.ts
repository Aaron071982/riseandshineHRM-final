import { DAY_LABELS, formatTime12h } from '@/lib/rbt-schedule/utils'

export type ScheduleSlotInput = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

function sortDays(days: number[]): number[] {
  return [...new Set(days)].sort(
    (a, b) => WEEK_ORDER.indexOf(a as (typeof WEEK_ORDER)[number]) -
      WEEK_ORDER.indexOf(b as (typeof WEEK_ORDER)[number])
  )
}

/**
 * Human-readable schedule for one BT, e.g. "Saturday, Sunday 12:00 PM–4:00 PM".
 * Groups days that share the same start/end time.
 */
export function formatScheduleForBt(slots: ScheduleSlotInput[]): string {
  if (!slots.length) return ''

  const byTime = new Map<string, number[]>()
  for (const slot of slots) {
    const key = `${slot.startTime}|${slot.endTime}`
    const days = byTime.get(key) ?? []
    days.push(slot.dayOfWeek)
    byTime.set(key, days)
  }

  const parts: string[] = []
  for (const [timeKey, days] of byTime) {
    const [start, end] = timeKey.split('|')
    const dayNames = sortDays(days)
      .map((d) => DAY_LABELS[d] ?? 'Day')
      .join(', ')
    parts.push(`${dayNames} ${formatTime12h(start!)}–${formatTime12h(end!)}`)
  }

  return parts.join('; ')
}
