import type { Prisma } from '@prisma/client'
import { NOT_DELETED } from '@/lib/crm/softDelete'

/** Verbatim cascade reason when staff member is marked departing. */
export const STAFF_DEPARTING_REPLACEMENT_REASON = 'staff departing'

/** Active schedule rows eligible for replacement flags. */
export const LIVE_SCHEDULE_ASSIGNMENT_WHERE: Prisma.RbtScheduleAssignmentWhereInput = {
  deletedAt: null,
  isActive: true,
  reviewStatus: { in: ['NONE', 'CONFIRMED'] },
}

export function isOpenReplacementFlag(row: {
  needsReplacement: boolean
  replacementResolvedAt: Date | null
}): boolean {
  return row.needsReplacement && row.replacementResolvedAt == null
}

export function isStaffDepartingCascadeReason(reason: string | null | undefined): boolean {
  return reason?.trim().toLowerCase() === STAFF_DEPARTING_REPLACEMENT_REASON
}

export function assignmentFlagPayload(input: {
  reason: string
  expectedEndDate: Date
  flaggedByUserId: string
  flaggedAt?: Date
}): Prisma.RbtScheduleAssignmentUncheckedUpdateManyInput {
  return {
    needsReplacement: true,
    replacementReason: input.reason.trim(),
    expectedEndDate: input.expectedEndDate,
    replacementFlaggedByUserId: input.flaggedByUserId,
    replacementFlaggedAt: input.flaggedAt ?? new Date(),
    replacementResolvedAt: null,
  }
}

export function assignmentResolvePayload(
  resolvedAt: Date = new Date()
): Prisma.RbtScheduleAssignmentUncheckedUpdateManyInput {
  return {
    needsReplacement: false,
    replacementResolvedAt: resolvedAt,
  }
}

export function assignmentClearFlagPayload(): Prisma.RbtScheduleAssignmentUncheckedUpdateManyInput {
  return {
    needsReplacement: false,
    replacementReason: null,
    expectedEndDate: null,
    replacementFlaggedByUserId: null,
    replacementFlaggedAt: null,
    replacementResolvedAt: null,
  }
}

/** Where clause: open replacement flag on a linked client assignment. */
export function openReplacementFlagWhere(
  serviceClientId: string
): Prisma.RbtScheduleAssignmentWhereInput {
  return {
    ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
    serviceClientId,
    needsReplacement: true,
    replacementResolvedAt: null,
  }
}

/** Client is active for staffing purposes (canonical §1 precursor). */
export const ACTIVE_STAFFING_CLIENT_WHERE: Prisma.ServiceClientWhereInput = {
  ...NOT_DELETED,
  pipelineStatus: 'LIVE',
  stage: 'ACTIVE',
}
