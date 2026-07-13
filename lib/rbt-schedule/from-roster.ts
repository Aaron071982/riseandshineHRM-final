import { distance } from 'fastest-levenshtein'
import { prisma } from '@/lib/prisma'
import type { ScheduleDayOfWeek } from '@prisma/client'
import { formatMinutes, type ScheduleAssignmentDTO } from '@/lib/rbt-schedule/utils'

const DAY_TO_JS: Record<ScheduleDayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
}

/** Normalize for comparison: lowercase, strip punctuation/hyphens, collapse spaces. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,']/g, ' ')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean)
}

function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - distance(na, nb) / maxLen
}

/**
 * Therapist roster name ↔ RBT profile name.
 * Supports: exact, Last/First flip, middle names, hyphenated vs spaced names,
 * and near-typo last names when first name matches (e.g. Logunle → Logunleko).
 */
export function namesMatch(therapistName: string, rbtFullName: string): boolean {
  const na = normalizeName(therapistName)
  const nb = normalizeName(rbtFullName)
  if (!na || !nb) return false
  if (na === nb) return true

  // "Last, First" ↔ "First Last"
  const flipComma = (s: string) => {
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    return parts.length === 2 ? normalizeName(`${parts[1]} ${parts[0]}`) : null
  }
  const fa = flipComma(therapistName)
  const fb = flipComma(rbtFullName)
  if (fa && fa === nb) return true
  if (fb && fb === na) return true

  const ta = tokens(therapistName)
  const tb = tokens(rbtFullName)
  if (ta.length === 0 || tb.length === 0) return false

  // Compact form equal (Stacy Ann Williams ↔ StacyAnnWilliams after hyphen split)
  if (ta.join('') === tb.join('')) return true

  // Same first + last token; ignore middlename differences
  // e.g. "Ahmed Abdelkhalek" ↔ "Ahmed noah Abdelkhalek"
  // e.g. "Stacy Ann-Williams" ↔ "Stacy-Ann Williams" → tokens stacy,ann,williams both ways
  if (ta.length >= 2 && tb.length >= 2) {
    if (ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]) return true
  }

  // Same first name + close last name (typos / truncated)
  if (ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0]) {
    const lastSim = similarity(ta[ta.length - 1], tb[tb.length - 1])
    if (lastSim >= 0.75) return true
  }

  // Strong full-string similarity (conservative)
  if (similarity(na, nb) >= 0.9) return true

  return false
}

export type RbtIdentity = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  userEmail?: string | null
}

/**
 * Load weekly-roster session slots for an RBT and map them to assignment DTOs.
 * Matching: therapist email → robust name match (middle names / hyphens / near-typos).
 */
export async function rosterAssignmentsForRbt(rbt: RbtIdentity): Promise<ScheduleAssignmentDTO[]> {
  const fullName = `${rbt.firstName} ${rbt.lastName}`.trim()
  const emails = [rbt.email, rbt.userEmail]
    .filter((e): e is string => !!e && e.trim().length > 0)
    .map((e) => e.trim().toLowerCase())

  const therapists = await prisma.scheduleTherapist.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true },
  })

  const matchedIds = therapists
    .filter((t) => {
      if (t.email && emails.includes(t.email.trim().toLowerCase())) return true
      return namesMatch(t.name, fullName)
    })
    .map((t) => t.id)

  if (matchedIds.length === 0) return []

  const slots = await prisma.scheduleSessionSlot.findMany({
    where: {
      therapistId: { in: matchedIds },
      status: { not: 'CANCELLED' },
    },
    include: { client: { select: { name: true } } },
    orderBy: [{ day: 'asc' }, { startMin: 'asc' }],
  })

  return slots.map((slot) => ({
    id: `roster:${slot.id}`,
    rbtProfileId: rbt.id,
    clientName: slot.client.name,
    dayOfWeek: DAY_TO_JS[slot.day],
    startTime: formatMinutes(slot.startMin),
    endTime: formatMinutes(slot.endMin),
    location: slot.placeOfService || null,
    notes: slot.note,
    isActive: true,
  }))
}

function assignmentKey(a: Pick<ScheduleAssignmentDTO, 'clientName' | 'dayOfWeek' | 'startTime' | 'endTime'>) {
  return `${normalizeName(a.clientName)}|${a.dayOfWeek}|${a.startTime}|${a.endTime}`
}

/** Prefer native assignments when they duplicate a roster slot; otherwise union both. */
export function mergeAssignments(
  native: ScheduleAssignmentDTO[],
  roster: ScheduleAssignmentDTO[]
): ScheduleAssignmentDTO[] {
  const seen = new Set(native.map(assignmentKey))
  const extras = roster.filter((r) => !seen.has(assignmentKey(r)))
  const merged = [...native, ...extras]
  merged.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
  return merged
}
