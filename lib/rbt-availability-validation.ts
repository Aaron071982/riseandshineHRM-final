/** Shared validation for RBT availability JSON and hourly slots (admin + RBT routes). */

const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)$/

export const WEEKDAY_KEYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
export const WEEKEND_KEYS = ['Saturday', 'Sunday'] as const

export type AvailabilityJsonInput = {
  weekday?: Record<string, boolean>
  weekend?: Record<string, boolean>
  earliestStartTime?: string | null
  latestEndTime?: string | null
}

export function validateTimeHm(s: string | undefined): string | null {
  if (s === undefined || s === '') return null
  if (typeof s !== 'string' || !HH_MM.test(s.trim())) {
    return 'earliestStartTime and latestEndTime must be HH:mm (e.g. 09:00)'
  }
  return null
}

/** Validate availabilityJson shape for Prisma Json column. */
export function validateAvailabilityJson(raw: unknown): { ok: true; value: AvailabilityJsonInput } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: {} }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'availabilityJson must be an object' }
  }
  const o = raw as Record<string, unknown>

  const checkMap = (label: string, v: unknown): string | null => {
    if (v === undefined) return null
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return `${label} must be an object of day name to boolean`
    for (const [k, val] of Object.entries(v)) {
      if (typeof val !== 'boolean') return `${label}.${k} must be boolean`
    }
    return null
  }

  const w1 = checkMap('weekday', o.weekday)
  if (w1) return { ok: false, error: w1 }
  const w2 = checkMap('weekend', o.weekend)
  if (w2) return { ok: false, error: w2 }

  if (o.earliestStartTime !== undefined && o.earliestStartTime !== null && o.earliestStartTime !== '') {
    const e = validateTimeHm(String(o.earliestStartTime))
    if (e) return { ok: false, error: e }
  }
  if (o.latestEndTime !== undefined && o.latestEndTime !== null && o.latestEndTime !== '') {
    const e = validateTimeHm(String(o.latestEndTime))
    if (e) return { ok: false, error: e }
  }

  const earliestStartTime =
    o.earliestStartTime === null || o.earliestStartTime === ''
      ? null
      : o.earliestStartTime !== undefined
        ? String(o.earliestStartTime).trim() || null
        : undefined
  const latestEndTime =
    o.latestEndTime === null || o.latestEndTime === ''
      ? null
      : o.latestEndTime !== undefined
        ? String(o.latestEndTime).trim() || null
        : undefined

  return {
    ok: true,
    value: {
      weekday: (o.weekday as Record<string, boolean>) ?? undefined,
      weekend: (o.weekend as Record<string, boolean>) ?? undefined,
      earliestStartTime,
      latestEndTime,
    },
  }
}

export type SlotInput = { dayOfWeek: number; hour: number }

export function validateSlots(slots: unknown): { ok: true; value: SlotInput[] } | { ok: false; error: string } {
  if (!Array.isArray(slots)) {
    return { ok: false, error: 'slots must be an array' }
  }
  for (const slot of slots) {
    if (typeof slot !== 'object' || slot === null || Array.isArray(slot)) {
      return { ok: false, error: 'Each slot must be an object' }
    }
    const s = slot as { dayOfWeek?: unknown; hour?: unknown }
    if (typeof s.dayOfWeek !== 'number' || s.dayOfWeek < 0 || s.dayOfWeek > 6) {
      return { ok: false, error: 'Invalid dayOfWeek: must be 0-6' }
    }
    if (typeof s.hour !== 'number' || s.hour < 14 || s.hour > 21) {
      return { ok: false, error: 'Invalid hour: must be 14-21 (2 PM to 9 PM)' }
    }
  }
  return { ok: true, value: slots as SlotInput[] }
}
