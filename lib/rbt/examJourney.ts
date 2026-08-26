import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import type { RbtExamFeeRequestStatus, RbtExamOutcome } from '@prisma/client'

export { PEARSON_VUE_BACB_URL } from '@/lib/rbt/examJourneyConstants'

export async function markCertJourneySeen(rbtProfileId: string) {
  await prisma.rBTProfile.update({
    where: { id: rbtProfileId },
    data: { rbtCertJourneySeenAt: new Date() },
  })
}

export async function requestExamFeeCover(input: {
  rbtProfileId: string
  note?: string | null
  actorUserId: string
}) {
  const open = await prisma.rbtExamFeeRequest.findFirst({
    where: { rbtProfileId: input.rbtProfileId, status: 'PENDING' },
  })
  if (open) {
    return { ok: false as const, error: 'You already have a pending fee request' }
  }

  const row = await prisma.rbtExamFeeRequest.create({
    data: {
      rbtProfileId: input.rbtProfileId,
      note: input.note?.trim() || null,
      status: 'PENDING',
    },
  })

  await writeAuditLog({
    actorUserId: input.actorUserId,
    entityType: 'RbtExamFeeRequest',
    entityId: row.id,
    action: 'CREATE',
    after: { status: 'PENDING', rbtProfileId: input.rbtProfileId },
  })

  return { ok: true as const, id: row.id }
}

export async function reviewExamFeeRequest(input: {
  requestId: string
  status: Extract<RbtExamFeeRequestStatus, 'APPROVED' | 'DENIED'>
  adminNote?: string | null
  actorUserId: string
}) {
  const existing = await prisma.rbtExamFeeRequest.findUnique({
    where: { id: input.requestId },
  })
  if (!existing) return { ok: false as const, error: 'Request not found' }
  if (existing.status !== 'PENDING') {
    return { ok: false as const, error: 'Request already reviewed' }
  }

  const row = await prisma.rbtExamFeeRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      adminNote: input.adminNote?.trim() || null,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
    },
  })

  await writeAuditLog({
    actorUserId: input.actorUserId,
    entityType: 'RbtExamFeeRequest',
    entityId: row.id,
    action: 'UPDATE',
    before: { status: existing.status },
    after: { status: input.status },
  })

  await prisma.rBTAuditLog.create({
    data: {
      rbtProfileId: existing.rbtProfileId,
      auditType: 'NOTE',
      dateTime: new Date(),
      notes: `Exam fee request ${input.status.toLowerCase()}.${input.adminNote ? ` Note: ${input.adminNote}` : ''} (cancellation fees are never covered)`,
      createdBy: input.actorUserId,
    },
  })

  return { ok: true as const }
}

export async function setExamSchedule(input: {
  rbtProfileId: string
  scheduledAt: Date
  actorUserId: string
}) {
  if (Number.isNaN(input.scheduledAt.getTime())) {
    return { ok: false as const, error: 'Invalid date/time' }
  }

  await prisma.rBTProfile.update({
    where: { id: input.rbtProfileId },
    data: {
      rbtExamScheduledAt: input.scheduledAt,
      // Clear prior outcome when rescheduling
      rbtExamOutcome: null,
      rbtExamOutcomeAt: null,
    },
  })

  await prisma.rBTAuditLog.create({
    data: {
      rbtProfileId: input.rbtProfileId,
      auditType: 'NOTE',
      dateTime: new Date(),
      notes: `RBT reported Pearson VUE exam scheduled for ${input.scheduledAt.toISOString()}`,
      createdBy: input.actorUserId,
    },
  })

  return { ok: true as const }
}

export async function setExamOutcome(input: {
  rbtProfileId: string
  outcome: RbtExamOutcome
  actorUserId: string
}) {
  await prisma.rBTProfile.update({
    where: { id: input.rbtProfileId },
    data: {
      rbtExamOutcome: input.outcome,
      rbtExamOutcomeAt: new Date(),
    },
  })

  await prisma.rBTAuditLog.create({
    data: {
      rbtProfileId: input.rbtProfileId,
      auditType: 'NOTE',
      dateTime: new Date(),
      notes: `RBT reported exam outcome: ${input.outcome}`,
      createdBy: input.actorUserId,
    },
  })

  return { ok: true as const }
}
