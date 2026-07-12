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

export function isRosterAssignmentId(id: string): boolean {
  return id.startsWith('roster:')
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // "Last, First" ↔ "First Last"
  const flipComma = (s: string) => {
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : null
  }
  const fa = flipComma(na)
  const fb = flipComma(nb)
  if (fa && fa === nb) return true
  if (fb && fb === na) return true
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
 * Matching: therapist email → exact normalized full name (no aggressive fuzzy).
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
