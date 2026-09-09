/**
 * Eastern "today" helpers for kiosk directory / attendance.
 * dayOfWeek: 0=Sunday … 6=Saturday (matches rbt_schedule_assignments).
 */

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function easternParts(now: Date): {
  year: number
  month: number
  day: number
  weekday: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: WEEKDAY_MAP[map.weekday || 'Sun'] ?? 0,
  }
}

/** Midnight America/New_York for the given calendar date, as a UTC Date. */
function easternMidnightUtc(year: number, month: number, day: number): Date {
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const nyHour = Number(
    probe.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    })
  )
  const offsetHours = 12 - nyHour
  return new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0))
}

/** 0=Sunday … 6=Saturday in America/New_York. */
export function easternDayOfWeek(now: Date = new Date()): number {
  return easternParts(now).weekday
}

/**
 * Half-open UTC range [start, end) covering the current Eastern calendar day.
 * Use for `eventAt` filters.
 */
export function easternTodayRangeUtc(now: Date = new Date()): {
  start: Date
  end: Date
} {
  const { year, month, day } = easternParts(now)
  const start = easternMidnightUtc(year, month, day)
  // Day+1 via Date.UTC handles month/year boundaries; re-resolve Eastern midnight.
  const tomorrowProbe = new Date(start.getTime() + 36 * 60 * 60 * 1000)
  const t = easternParts(tomorrowProbe)
  const end = easternMidnightUtc(t.year, t.month, t.day)
  return { start, end }
}

/** Eastern calendar date as UTC midnight Date for `@db.Date` comparisons. */
export function easternTodayDateUtc(now: Date = new Date()): Date {
  const { year, month, day } = easternParts(now)
  return new Date(Date.UTC(year, month - 1, day))
}
