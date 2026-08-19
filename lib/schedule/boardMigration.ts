import { namesMatch, normalizeName } from '@/lib/rbt-schedule/from-roster'
import { matchScheduleNameToClient } from '@/lib/client-services/scheduleSync'
import { formatMinutes } from '@/lib/rbt-schedule/utils'
import type { ScheduleDayOfWeek } from '@prisma/client'

export const JS_DAY_FROM_ENUM: Record<ScheduleDayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
}

export function isArtemisMirrorNote(note: string | null | undefined): boolean {
  return (note ?? '').trim().toLowerCase() === 'artemis import'
}

export function assignmentFingerprint(input: {
  rbtProfileId: string
  clientName: string
  dayOfWeek: number
  startTime: string
  endTime: string
}): string {
  return [
    input.rbtProfileId,
    normalizeName(input.clientName),
    String(input.dayOfWeek),
    input.startTime,
    input.endTime,
  ].join('|')
}

export type BoardTherapist = {
  id: string
  name: string
  email: string | null
}

export type BoardClient = {
  id: string
  name: string
  borough: string | null
}

export type BoardSlot = {
  id: string
  therapistId: string
  clientId: string
  day: ScheduleDayOfWeek
  startMin: number
  endMin: number
  placeOfService: string
  note: string | null
}

export type RbtCandidate = {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

export type ServiceClientCandidate = {
  id: string
  firstName: string
  lastName: string
  pipelineStatus: string
}

export type ExistingAssignment = {
  id: string
  rbtProfileId: string
  clientName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  serviceClientId: string | null
  isActive: boolean
}

export type BoardMigrationDisposition =
  | 'mirror'
  | 'already_migrated'
  | 'already_represented'
  | 'unresolved_rbt'
  | 'migrate'

export type BoardMigrationPlanRow = {
  boardSlotId: string
  therapistName: string
  therapistEmail: string | null
  clientName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string | null
  disposition: BoardMigrationDisposition
  rbtProfileId: string | null
  rbtMatch: 'email' | 'name' | null
  serviceClientId: string | null
  serviceClientMatch: 'exact' | 'fuzzy' | null
  serviceClientLive: boolean | null
  conflictAssignmentIds: string[]
  conflictNote: string | null
}

export function matchTherapistToRbt(
  therapist: BoardTherapist,
  rbts: RbtCandidate[]
): { id: string; how: 'email' | 'name' } | null {
  const email = therapist.email?.trim().toLowerCase()
  if (email) {
    const byEmail = rbts.filter((r) => r.email?.trim().toLowerCase() === email)
    if (byEmail.length === 1) return { id: byEmail[0].id, how: 'email' }
  }
  const nameHits = rbts.filter((r) =>
    namesMatch(therapist.name, `${r.firstName} ${r.lastName}`.trim())
  )
  if (nameHits.length === 1) return { id: nameHits[0].id, how: 'name' }
  return null
}

export function planBoardSlot(opts: {
  slot: BoardSlot
  therapist: BoardTherapist | undefined
  client: BoardClient | undefined
  rbts: RbtCandidate[]
  serviceClients: ServiceClientCandidate[]
  existingFingerprints: Set<string>
  alreadyMigratedSlotIds: Set<string>
  activeByClientKey: Map<string, ExistingAssignment[]>
}): BoardMigrationPlanRow {
  const { slot, therapist, client } = opts
  const clientName = client?.name?.trim() || slot.clientId
  const startTime = formatMinutes(slot.startMin)
  const endTime = formatMinutes(slot.endMin)
  const dayOfWeek = JS_DAY_FROM_ENUM[slot.day] ?? 1

  const base: Omit<
    BoardMigrationPlanRow,
    'disposition' | 'rbtProfileId' | 'rbtMatch' | 'conflictAssignmentIds' | 'conflictNote'
  > & {
    rbtProfileId: string | null
    rbtMatch: 'email' | 'name' | null
  } = {
    boardSlotId: slot.id,
    therapistName: therapist?.name ?? slot.therapistId,
    therapistEmail: therapist?.email ?? null,
    clientName,
    dayOfWeek,
    startTime,
    endTime,
    location: slot.placeOfService || null,
    serviceClientId: null,
    serviceClientMatch: null,
    serviceClientLive: null,
    rbtProfileId: null,
    rbtMatch: null,
  }

  if (isArtemisMirrorNote(slot.note)) {
    return {
      ...base,
      disposition: 'mirror',
      conflictAssignmentIds: [],
      conflictNote: 'Artemis import mirror — already in rbt_schedule_assignments',
    }
  }

  if (opts.alreadyMigratedSlotIds.has(slot.id)) {
    return {
      ...base,
      disposition: 'already_migrated',
      conflictAssignmentIds: [],
      conflictNote: 'boardSlotId already present',
    }
  }

  const rbt = therapist ? matchTherapistToRbt(therapist, opts.rbts) : null
  if (rbt) {
    base.rbtProfileId = rbt.id
    base.rbtMatch = rbt.how
  }

  const clientMatch = matchScheduleNameToClient(clientName, opts.serviceClients)
  if (clientMatch) {
    base.serviceClientId = clientMatch.id
    base.serviceClientMatch = clientMatch.confidence
    const sc = opts.serviceClients.find((c) => c.id === clientMatch.id)
    base.serviceClientLive = sc ? sc.pipelineStatus === 'LIVE' : null
  }

  if (base.rbtProfileId) {
    const fp = assignmentFingerprint({
      rbtProfileId: base.rbtProfileId,
      clientName,
      dayOfWeek,
      startTime,
      endTime,
    })
    if (opts.existingFingerprints.has(fp)) {
      return {
        ...base,
        disposition: 'already_represented',
        conflictAssignmentIds: [],
        conflictNote: 'Matching live assignment already exists (same RBT/day/time/client)',
      }
    }
  }

  if (!base.rbtProfileId) {
    return {
      ...base,
      disposition: 'unresolved_rbt',
      conflictAssignmentIds: [],
      conflictNote: 'Could not uniquely match board therapist to an RBT profile',
    }
  }

  const clientKeys = [
    base.serviceClientId ? `id:${base.serviceClientId}` : null,
    `name:${normalizeName(clientName)}`,
  ].filter((k): k is string => !!k)

  const conflictIds = new Set<string>()
  for (const key of clientKeys) {
    for (const row of opts.activeByClientKey.get(key) ?? []) {
      if (row.rbtProfileId !== base.rbtProfileId) conflictIds.add(row.id)
    }
  }

  return {
    ...base,
    disposition: 'migrate',
    conflictAssignmentIds: [...conflictIds],
    conflictNote:
      conflictIds.size > 0
        ? 'Active assignment already exists for this client with a different RBT (possible therapist switch)'
        : null,
  }
}

export function summarizePlan(rows: BoardMigrationPlanRow[]): Record<BoardMigrationDisposition, number> {
  const counts: Record<BoardMigrationDisposition, number> = {
    mirror: 0,
    already_migrated: 0,
    already_represented: 0,
    unresolved_rbt: 0,
    migrate: 0,
  }
  for (const row of rows) counts[row.disposition]++
  return counts
}
