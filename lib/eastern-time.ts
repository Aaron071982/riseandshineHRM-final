/**
 * Helpers for America/New_York timezone. Used for interview slot generation and display.
 * Uses simple EST/EDT offset (EST = UTC-5, EDT = UTC-4). DST: 2nd Sun Mar - 1st Sun Nov.
 */

function getEasternOffsetHours(date: Date): number {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  // US DST: 2nd Sunday March - 1st Sunday November (simplified: March 8 - Nov 1 for 2026)
  const marchSecondSunday = 8 + (14 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7
  const novFirstSunday = 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7
  const isEDT =
    month > 3 ||
    (month === 3 && day >= marchSecondSunday) ||
    (month < 11 || (month === 11 && day < novFirstSunday))
  return isEDT ? 4 : 5
}

/** Given a local date/time in America/New_York, return the UTC Date. */
export function easternToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offset = getEasternOffsetHours(d)
  return new Date(Date.UTC(year, month - 1, day, hour + offset, minute, 0))
}

/** Get the current date (YYYY-MM-DD) in America/New_York. */
export function todayEastern(): { year: number; month: number; day: number } {
  return getEasternDate(new Date())
}

/** Given a UTC Date, return the calendar date (year, month, day) in America/New_York. */
export function getEasternDate(utcDate: Date): { year: number; month: number; day: number } {
  const str = utcDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const match = str.match(/(\d+)\/(\d+)\/(\d+)/)
  if (match) {
    return { month: parseInt(match[1], 10), day: parseInt(match[2], 10), year: parseInt(match[3], 10) }
  }
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  }
}

/** Format a Date for display in Eastern. */
export function formatEastern(d: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  })
}
