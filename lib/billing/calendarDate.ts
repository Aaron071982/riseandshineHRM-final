/**
 * Calendar dates (DOS) have no timezone — always parse and format via UTC components
 * so Excel midnight UTC values and DB @db.Date fields stay on the correct day.
 */

export function parseCalendarDate(value: unknown): Date | null {
  if (value == null || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    )
  }

  const s = String(value).trim()
  if (!s) return null

  const parts = s.split(/[/-]/)
  if (parts.length >= 3) {
    const month = parseInt(parts[0], 10)
    const day = parseInt(parts[1], 10)
    let year = parseInt(parts[2], 10)
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day))
    }
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
    )
  }

  return null
}

export function calendarDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** US-style M/D/YYYY from a calendar date stored as UTC midnight. */
export function formatCalendarDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const m = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const y = date.getUTCFullYear()
  return `${m}/${day}/${y}`
}

/** Noon UTC avoids Excel timezone edge cases when writing date cells. */
export function calendarDateForExcel(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
}
