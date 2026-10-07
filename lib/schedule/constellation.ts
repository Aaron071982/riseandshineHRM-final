import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from '@/lib/schedule/types'
import { DAYS, DAY_LABEL, findConflicts, hoursOf, rangeShort, type Day } from '@/lib/schedule/utils'

export const DEFAULT_WEEKLY_TARGET_HOURS = 40

export type UtilizationBand = 'under' | 'healthy' | 'near' | 'over'

export const UTILIZATION_BANDS: UtilizationBand[] = ['over', 'near', 'healthy', 'under']

export const BAND_META: Record<
  UtilizationBand,
  { label: string; short: string; color: string; bg: string; symbol: string }
> = {
  under: { label: 'Has room (<50%)', short: 'Has room', color: 'var(--blue)', bg: 'var(--blue-bg)', symbol: '○' },
  healthy: { label: 'Healthy (50–90%)', short: 'Healthy', color: 'var(--green)', bg: 'var(--green-bg)', symbol: '●' },
  near: { label: 'Near capacity (90–100%)', short: 'Near capacity', color: 'var(--amber)', bg: 'var(--amber-bg)', symbol: '▲' },
  over: { label: 'Over capacity (>100%)', short: 'Over capacity', color: 'var(--urgent)', bg: 'var(--urgent-bg)', symbol: '■' },
}

export function utilizationBand(scheduledHours: number, targetHours: number): UtilizationBand {
  const target = targetHours > 0 ? targetHours : DEFAULT_WEEKLY_TARGET_HOURS
  const pct = scheduledHours / target
  if (pct > 1) return 'over'
  if (pct >= 0.9) return 'near'
  if (pct >= 0.5) return 'healthy'
  return 'under'
}

export type TargetSource = 'ADMIN' | 'PREFERENCE' | 'DEFAULT'

/**
 * Admin-set target wins; otherwise the upper bound of the applicant's preferred range
 * ("15-25" → 25). Open-ended ranges ("35+") never drop below the default.
 */
export function resolveWeeklyTarget(input: {
  weeklyTargetHours: number | null
  preferredHoursRange: string | null
}): { hours: number; source: TargetSource } {
  if (input.weeklyTargetHours != null && input.weeklyTargetHours > 0) {
    return { hours: input.weeklyTargetHours, source: 'ADMIN' }
  }
  const pref = input.preferredHoursRange?.trim()
  if (pref) {
    const nums = pref.match(/\d+(\.\d+)?/g)?.map(Number).filter((n) => n > 0) ?? []
    if (nums.length) {
      const max = Math.max(...nums)
      const openEnded = /\+|or more|plus/i.test(pref)
      return {
        hours: openEnded ? Math.max(max, DEFAULT_WEEKLY_TARGET_HOURS) : max,
        source: 'PREFERENCE',
      }
    }
  }
  return { hours: DEFAULT_WEEKLY_TARGET_HOURS, source: 'DEFAULT' }
}

export type CapacityTarget = { hours: number; source: TargetSource; preferredHoursRange: string | null }

export type PairModel = {
  key: string
  therapistId: string
  clientId: string
  slots: ScheduleSlot[]
  hours: number
  conflictReasons: string[]
}

export type TherapistModel = {
  therapist: ScheduleTherapist
  hours: number
  target: CapacityTarget
  band: UtilizationBand
  conflictCount: number
  pairKeys: string[]
  /** Borough with the most scheduled hours for this therapist (client borough). */
  primaryBorough: string | null
}

export type ClientModel = {
  client: ScheduleClient
  hours: number
  therapistIds: string[]
  conflictCount: number
}

export type ConstellationModel = {
  therapists: Map<string, TherapistModel>
  clients: Map<string, ClientModel>
  pairs: Map<string, PairModel>
}

export const pairKey = (therapistId: string, clientId: string) => `${therapistId}::${clientId}`

const DAY_ORDER = new Map<Day, number>(DAYS.map((d, i) => [d, i]))

export function sortSlots<T extends Pick<ScheduleSlot, 'day' | 'startMin'>>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) => (DAY_ORDER.get(a.day as Day) ?? 0) - (DAY_ORDER.get(b.day as Day) ?? 0) || a.startMin - b.startMin
  )
}

/** "Tue 4–7p · Wed 4–7p" */
export function slotsLabel(slots: Pick<ScheduleSlot, 'day' | 'startMin' | 'endMin'>[], max = 3): string {
  const sorted = sortSlots(slots)
  const parts = sorted.slice(0, max).map((s) => `${DAY_LABEL[s.day as Day]} ${rangeShort(s.startMin, s.endMin)}`)
  if (sorted.length > max) parts.push(`+${sorted.length - max} more`)
  return parts.join(' · ')
}

export function buildConstellationModel(input: {
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  conflicts: Map<string, string[]>
  targets: Map<string, CapacityTarget>
}): ConstellationModel {
  const active = input.slots.filter((s) => s.status !== 'CANCELLED')
  const clientById = new Map(input.clients.map((c) => [c.id, c]))

  const pairs = new Map<string, PairModel>()
  for (const s of active) {
    const key = pairKey(s.therapistId, s.clientId)
    let p = pairs.get(key)
    if (!p) {
      p = { key, therapistId: s.therapistId, clientId: s.clientId, slots: [], hours: 0, conflictReasons: [] }
      pairs.set(key, p)
    }
    p.slots.push(s)
    p.hours += hoursOf(s)
    for (const r of input.conflicts.get(s.id) ?? []) {
      if (!p.conflictReasons.includes(r)) p.conflictReasons.push(r)
    }
  }
  for (const p of pairs.values()) p.slots = sortSlots(p.slots)

  const therapists = new Map<string, TherapistModel>()
  for (const t of input.therapists) {
    const target = input.targets.get(t.id) ?? {
      hours: DEFAULT_WEEKLY_TARGET_HOURS,
      source: 'DEFAULT' as const,
      preferredHoursRange: null,
    }
    therapists.set(t.id, {
      therapist: t,
      hours: 0,
      target,
      band: 'under',
      conflictCount: 0,
      pairKeys: [],
      primaryBorough: null,
    })
  }

  const clients = new Map<string, ClientModel>()
  const boroughHours = new Map<string, Map<string, number>>()
  for (const p of pairs.values()) {
    const tm = therapists.get(p.therapistId)
    if (tm) {
      tm.hours += p.hours
      tm.pairKeys.push(p.key)
      tm.conflictCount += p.slots.filter((s) => input.conflicts.has(s.id)).length
      const borough = clientById.get(p.clientId)?.borough ?? 'Unset'
      const byBorough = boroughHours.get(p.therapistId) ?? new Map<string, number>()
      byBorough.set(borough, (byBorough.get(borough) ?? 0) + p.hours)
      boroughHours.set(p.therapistId, byBorough)
    }
    const client = clientById.get(p.clientId)
    if (!client) continue
    const cm = clients.get(p.clientId) ?? { client, hours: 0, therapistIds: [], conflictCount: 0 }
    cm.hours += p.hours
    if (!cm.therapistIds.includes(p.therapistId)) cm.therapistIds.push(p.therapistId)
    cm.conflictCount += p.slots.filter((s) => input.conflicts.has(s.id)).length
    clients.set(p.clientId, cm)
  }

  for (const tm of therapists.values()) {
    tm.band = utilizationBand(tm.hours, tm.target.hours)
    const byBorough = boroughHours.get(tm.therapist.id)
    if (byBorough) {
      tm.primaryBorough = [...byBorough.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
    }
  }

  return { therapists, clients, pairs }
}

export type ReassignmentPreview = {
  movingSlots: ScheduleSlot[]
  from: { therapistId: string; hoursBefore: number; hoursAfter: number; target: number }
  to: { therapistId: string; hoursBefore: number; hoursAfter: number; target: number }
  /** Conflicts on moved sessions that do not exist today, keyed by slot id. */
  newConflicts: Map<string, string[]>
}

export function previewReassignment(input: {
  slots: ScheduleSlot[]
  movingSlotIds: string[]
  fromTherapistId: string
  toTherapistId: string
  model: ConstellationModel
}): ReassignmentPreview {
  const moving = new Set(input.movingSlotIds)
  const movingSlots = input.slots.filter((s) => moving.has(s.id))
  const movedHours = movingSlots.filter((s) => s.status !== 'CANCELLED').reduce((a, s) => a + hoursOf(s), 0)

  const before = findConflicts(input.slots)
  const hypothetical = input.slots.map((s) => (moving.has(s.id) ? { ...s, therapistId: input.toTherapistId } : s))
  const after = findConflicts(hypothetical)
  const newConflicts = new Map<string, string[]>()
  for (const id of moving) {
    const prev = before.get(id) ?? []
    const added = (after.get(id) ?? []).filter((r) => !prev.includes(r))
    if (added.length) newConflicts.set(id, added)
  }

  const from = input.model.therapists.get(input.fromTherapistId)
  const to = input.model.therapists.get(input.toTherapistId)
  return {
    movingSlots: sortSlots(movingSlots),
    from: {
      therapistId: input.fromTherapistId,
      hoursBefore: from?.hours ?? 0,
      hoursAfter: (from?.hours ?? 0) - movedHours,
      target: from?.target.hours ?? DEFAULT_WEEKLY_TARGET_HOURS,
    },
    to: {
      therapistId: input.toTherapistId,
      hoursBefore: to?.hours ?? 0,
      hoursAfter: (to?.hours ?? 0) + movedHours,
      target: to?.target.hours ?? DEFAULT_WEEKLY_TARGET_HOURS,
    },
    newConflicts,
  }
}
