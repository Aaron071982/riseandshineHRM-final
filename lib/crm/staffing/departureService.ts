import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseCalendarDate } from '@/lib/billing/calendarDate'
import {
  auditRbtDeparture,
  auditStaffingReplacementForClient,
} from '@/lib/crm/staffing/audit'
import {
  STAFF_DEPARTING_REPLACEMENT_REASON,
  LIVE_SCHEDULE_ASSIGNMENT_WHERE,
  assignmentClearFlagPayload,
  assignmentFlagPayload,
  assignmentResolvePayload,
  isStaffDepartingCascadeReason,
} from '@/lib/crm/staffing/departure'

type FlagAssignmentInput = {
  serviceClientId: string
  rbtProfileId: string
  reason: string
  expectedEndDate: Date
  flaggedByUserId: string
}

async function distinctClientIdsForAssignments(
  where: Prisma.RbtScheduleAssignmentWhereInput
): Promise<string[]> {
  const rows = await prisma.rbtScheduleAssignment.findMany({
    where,
    select: { serviceClientId: true },
    distinct: ['serviceClientId'],
  })
  return rows
    .map((r) => r.serviceClientId)
    .filter((id): id is string => !!id)
}

async function flagAssignments(
  where: Prisma.RbtScheduleAssignmentWhereInput,
  payload: ReturnType<typeof assignmentFlagPayload>
): Promise<number> {
  const result = await prisma.rbtScheduleAssignment.updateMany({
    where,
    data: payload,
  })
  return result.count
}

/** Flag all live schedule rows for a client + RBT pair. */
export async function flagClientRbtReplacement(input: FlagAssignmentInput): Promise<{
  updatedCount: number
}> {
  const payload = assignmentFlagPayload(input)
  const where = {
    ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
    serviceClientId: input.serviceClientId,
    rbtProfileId: input.rbtProfileId,
  }
  const updatedCount = await flagAssignments(where, payload)
  await auditStaffingReplacementForClient({
    userId: input.flaggedByUserId,
    serviceClientId: input.serviceClientId,
    action: `REPLACEMENT_FLAG:rbt=${input.rbtProfileId}:rows=${updatedCount}`,
  })
  return { updatedCount }
}

/** Clear open replacement flags for a client + RBT pair (manual unflag). */
export async function clearClientRbtReplacement(input: {
  serviceClientId: string
  rbtProfileId: string
  clearedByUserId: string
}): Promise<{ updatedCount: number }> {
  const where = {
    ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
    serviceClientId: input.serviceClientId,
    rbtProfileId: input.rbtProfileId,
    needsReplacement: true,
    replacementResolvedAt: null,
  }
  const updatedCount = await flagAssignments(where, assignmentClearFlagPayload())
  await auditStaffingReplacementForClient({
    userId: input.clearedByUserId,
    serviceClientId: input.serviceClientId,
    action: `REPLACEMENT_CLEAR:rbt=${input.rbtProfileId}:rows=${updatedCount}`,
  })
  return { updatedCount }
}

/** Mark RBT departing and cascade replacement flags to all active assignments. */
export async function flagRbtStaffDeparting(input: {
  rbtProfileId: string
  lastDay: Date
  departureNote?: string | null
  flaggedByUserId: string
}): Promise<{ updatedAssignmentRows: number; affectedClientIds: string[] }> {
  const now = new Date()
  const payload = assignmentFlagPayload({
    reason: STAFF_DEPARTING_REPLACEMENT_REASON,
    expectedEndDate: input.lastDay,
    flaggedByUserId: input.flaggedByUserId,
    flaggedAt: now,
  })

  await prisma.rBTProfile.update({
    where: { id: input.rbtProfileId },
    data: {
      departing: true,
      departureLastDay: input.lastDay,
      departureNote: input.departureNote?.trim() || null,
      departureFlaggedByUserId: input.flaggedByUserId,
      departureFlaggedAt: now,
    },
  })

  const assignmentWhere = {
    ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
    rbtProfileId: input.rbtProfileId,
    serviceClientId: { not: null },
  }
  const affectedClientIds = await distinctClientIdsForAssignments(assignmentWhere)
  const updatedAssignmentRows = await flagAssignments(assignmentWhere, payload)

  await auditRbtDeparture({
    rbtProfileId: input.rbtProfileId,
    userId: input.flaggedByUserId,
    action: 'DEPARTURE_FLAG',
    note: `Last day ${input.lastDay.toISOString().slice(0, 10)}; cascaded to ${updatedAssignmentRows} assignment row(s) across ${affectedClientIds.length} client(s).`,
  })

  for (const serviceClientId of affectedClientIds) {
    await auditStaffingReplacementForClient({
      userId: input.flaggedByUserId,
      serviceClientId,
      action: `REPLACEMENT_CASCADE_STAFF_DEPARTING:rbt=${input.rbtProfileId}`,
    })
  }

  return { updatedAssignmentRows, affectedClientIds }
}

/** Unflag staff departing; reverse open staff-departing cascade flags. */
export async function clearRbtStaffDeparting(input: {
  rbtProfileId: string
  clearedByUserId: string
}): Promise<{ clearedAssignmentRows: number }> {
  await prisma.rBTProfile.update({
    where: { id: input.rbtProfileId },
    data: {
      departing: false,
      departureLastDay: null,
      departureNote: null,
      departureFlaggedByUserId: null,
      departureFlaggedAt: null,
    },
  })

  const where = {
    ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
    rbtProfileId: input.rbtProfileId,
    needsReplacement: true,
    replacementResolvedAt: null,
    replacementReason: STAFF_DEPARTING_REPLACEMENT_REASON,
  }
  const affectedClientIds = await distinctClientIdsForAssignments(where)
  const clearedAssignmentRows = await flagAssignments(where, assignmentClearFlagPayload())

  await auditRbtDeparture({
    rbtProfileId: input.rbtProfileId,
    userId: input.clearedByUserId,
    action: 'DEPARTURE_CLEAR',
    note: `Cleared ${clearedAssignmentRows} open staff-departing assignment flag(s).`,
  })

  for (const serviceClientId of affectedClientIds) {
    await auditStaffingReplacementForClient({
      userId: input.clearedByUserId,
      serviceClientId,
      action: `REPLACEMENT_CASCADE_CLEAR:rbt=${input.rbtProfileId}`,
    })
  }

  return { clearedAssignmentRows }
}

/**
 * Auto-resolve open replacement flags when a replacement RBT is assigned.
 * Clears flags for other RBTs on the same client when a new RBT gets schedule rows.
 */
export async function resolveReplacementFlagsOnNewAssignment(input: {
  serviceClientId: string
  newRbtProfileId: string
  resolvedByUserId: string
}): Promise<{ resolvedCount: number }> {
  const where = {
    ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
    serviceClientId: input.serviceClientId,
    rbtProfileId: { not: input.newRbtProfileId },
    needsReplacement: true,
    replacementResolvedAt: null,
  }
  const resolvedCount = await flagAssignments(where, assignmentResolvePayload())
  if (resolvedCount > 0) {
    await auditStaffingReplacementForClient({
      userId: input.resolvedByUserId,
      serviceClientId: input.serviceClientId,
      action: `REPLACEMENT_AUTO_RESOLVE:new_rbt=${input.newRbtProfileId}:rows=${resolvedCount}`,
    })
  }
  return { resolvedCount }
}

export function parseExpectedEndDate(raw: string | null | undefined): Date | null {
  return parseCalendarDate(raw)
}

export { isStaffDepartingCascadeReason, STAFF_DEPARTING_REPLACEMENT_REASON }
