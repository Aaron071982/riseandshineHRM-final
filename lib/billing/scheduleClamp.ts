/**
 * Clamp payable session time to the overlap of scheduled and actual windows.
 *
 * payStart = later of (scheduled start, actual start)
 * payEnd   = earlier of (scheduled end, actual end)
 * payable  = max(0, payEnd − payStart)
 */

export const REVIEW_FLAG = {
  DATE_MISMATCH: 'NEEDS_REVIEW — date mismatch',
  NO_OVERLAP: 'NEEDS_REVIEW — no schedule overlap',
  MISSING_TIMES: 'no clamp applied — missing times',
} as const

export type ReviewFlag = (typeof REVIEW_FLAG)[keyof typeof REVIEW_FLAG] | string

export type ClampInput = {
  scheduledStart: Date | null
  scheduledEnd: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  rawActualMinutes: number
}

export type ClampResult = {
  payableMinutes: number
  clampedPayableMinutes: number
  clampApplied: boolean
  reviewFlag: string | null
  /** True when payable minutes differ from raw (docked or zeroed). */
  hoursChanged: boolean
}

/** Calendar day key in local time — used for date-mismatch detection. */
export function calendarDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Parse Artemis datetimes like "7/29/2026, 4:00 PM" or "7/29/2026 4:00 PM".
 * Also accepts Excel Date objects / serials already coerced by ExcelJS.
 */
export function parseArtemisDateTime(value: unknown): Date | null {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date (days since 1899-12-30)
    if (value > 20000 && value < 100000) {
      const excelEpoch = Date.UTC(1899, 11, 30)
      const ms = excelEpoch + value * 86400000
      const d = new Date(ms)
      return Number.isFinite(d.getTime()) ? d : null
    }
    return null
  }

  if (typeof value === 'object' && value !== null && 'result' in value) {
    return parseArtemisDateTime((value as { result: unknown }).result)
  }

  if (typeof value === 'object' && value !== null && 'text' in value) {
    return parseArtemisDateTime((value as { text: unknown }).text)
  }

  const s = String(value).trim()
  if (!s) return null

  // "M/D/YYYY, h:mm AM/PM" or "M/D/YYYY h:mm AM/PM" (optional seconds)
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  )
  if (m) {
    const month = parseInt(m[1], 10)
    const day = parseInt(m[2], 10)
    const year = parseInt(m[3], 10)
    let hour = parseInt(m[4], 10)
    const minute = parseInt(m[5], 10)
    const second = m[6] ? parseInt(m[6], 10) : 0
    const ampm = m[7].toUpperCase()
    if (ampm === 'PM' && hour < 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0
    const d = new Date(year, month - 1, day, hour, minute, second)
    return Number.isFinite(d.getTime()) ? d : null
  }

  // Fallback: native parse (ISO, etc.)
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d : null
}

export function isBlockingReviewFlag(flag: string | null | undefined): boolean {
  if (!flag) return false
  return flag.includes('NEEDS_REVIEW') || flag === REVIEW_FLAG.MISSING_TIMES
}

export function computeClampedPayable(input: ClampInput): ClampResult {
  const raw = Math.max(0, input.rawActualMinutes)
  const { scheduledStart, scheduledEnd, actualStart, actualEnd } = input

  const allPresent = !!(scheduledStart && scheduledEnd && actualStart && actualEnd)
  if (!allPresent) {
    return {
      payableMinutes: raw,
      clampedPayableMinutes: raw,
      clampApplied: false,
      reviewFlag: REVIEW_FLAG.MISSING_TIMES,
      hoursChanged: false,
    }
  }

  // Date mismatch: do NOT clamp across days — fall back to raw
  if (calendarDayKey(scheduledStart) !== calendarDayKey(actualStart)) {
    return {
      payableMinutes: raw,
      clampedPayableMinutes: raw,
      clampApplied: false,
      reviewFlag: REVIEW_FLAG.DATE_MISMATCH,
      hoursChanged: false,
    }
  }

  const payStartMs = Math.max(scheduledStart.getTime(), actualStart.getTime())
  const payEndMs = Math.min(scheduledEnd.getTime(), actualEnd.getTime())
  const overlapMs = payEndMs - payStartMs
  const payableMinutes = Math.max(0, overlapMs / 60000)

  if (payEndMs <= payStartMs) {
    return {
      payableMinutes: 0,
      clampedPayableMinutes: 0,
      clampApplied: true,
      reviewFlag: REVIEW_FLAG.NO_OVERLAP,
      hoursChanged: raw > 0,
    }
  }

  // Tiny float noise: treat as unchanged when within 0.01 min
  const hoursChanged = Math.abs(payableMinutes - raw) > 0.01

  return {
    payableMinutes,
    clampedPayableMinutes: payableMinutes,
    clampApplied: true,
    reviewFlag: null,
    hoursChanged,
  }
}
