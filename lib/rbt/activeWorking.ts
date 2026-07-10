import { PostHireStage } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function countSchedulingAssignments(rbtProfileId: string): Promise<number> {
  return prisma.clientAssignment.count({ where: { rbtProfileId } })
}

async function writeAudit(
  rbtProfileId: string,
  auditType: string,
  notes: string,
  createdBy: string | null
): Promise<void> {
  await prisma.rBTAuditLog.create({
    data: {
      rbtProfileId,
      auditType,
      dateTime: new Date(),
      notes,
      createdBy,
    },
  })
}

export async function tryAutoMarkActivelyWorking(
  rbtProfileId: string,
  actorEmail: string | null
): Promise<{ marked: boolean }> {
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: {
      id: true,
      status: true,
      postHireStage: true,
      activeWorkingManualOverride: true,
      activeWorkingSince: true,
    },
  })
  if (!profile) return { marked: false }
  if (profile.status !== 'HIRED') return { marked: false }
  if (profile.activeWorkingManualOverride) return { marked: false }
  if (profile.postHireStage === PostHireStage.ACTIVE_DELIVERY) return { marked: false }

  const assignmentCount = await countSchedulingAssignments(rbtProfileId)
  if (assignmentCount < 1) return { marked: false }

  const now = new Date()
  await prisma.rBTProfile.update({
    where: { id: rbtProfileId },
    data: {
      postHireStage: PostHireStage.ACTIVE_DELIVERY,
      activeWorkingSince: profile.activeWorkingSince ?? now,
    },
  })
  await writeAudit(
    rbtProfileId,
    'MARKED_ACTIVELY_WORKING',
    'Auto-marked active after client assignment',
    actorEmail
  )
  return { marked: true }
}

export async function markActivelyWorkingManual(
  rbtProfileId: string,
  actor: string | null,
  reason?: string | null,
  options?: { keepActiveReview?: boolean }
): Promise<void> {
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { activeWorkingSince: true, status: true },
  })
  if (!profile || profile.status !== 'HIRED') {
    throw new Error('RBT must be hired to mark as actively working')
  }

  const terminated = await prisma.termination.findUnique({
    where: { rbtProfileId },
    select: { id: true },
  })
  if (terminated) {
    throw new Error('Cannot activate a terminated employee')
  }

  const now = new Date()
  await prisma.rBTProfile.update({
    where: { id: rbtProfileId },
    data: {
      postHireStage: PostHireStage.ACTIVE_DELIVERY,
      activeWorkingSince: profile.activeWorkingSince ?? now,
      activeWorkingManualOverride: true,
    },
  })

  const note = options?.keepActiveReview
    ? 'Kept actively working status (no active clients)'
    : reason?.trim()
      ? `Manually marked actively working: ${reason.trim()}`
      : 'Manually marked actively working'

  await writeAudit(
    rbtProfileId,
    options?.keepActiveReview ? 'NOTE' : 'MARKED_ACTIVELY_WORKING',
    note,
    actor
  )
}

export async function removeActiveStatusManual(
  rbtProfileId: string,
  actor: string | null,
  reason: string
): Promise<void> {
  const trimmed = reason.trim()
  if (!trimmed) throw new Error('Reason is required')

  await prisma.rBTProfile.update({
    where: { id: rbtProfileId },
    data: {
      postHireStage: PostHireStage.MATCHING,
      activeWorkingSince: null,
      activeWorkingManualOverride: true,
    },
  })
  await writeAudit(rbtProfileId, 'REMOVED_ACTIVELY_WORKING', trimmed, actor)
}

export type BtReviewNoClientsItem = {
  rbtProfileId: string
  firstName: string
  lastName: string
  email: string | null
  activeWorkingSince: Date | null
  lastAssignmentEndedAt: Date | null
}

export async function listBtReviewNoClients(): Promise<BtReviewNoClientsItem[]> {
  const activeProfiles = await prisma.rBTProfile.findMany({
    where: { postHireStage: PostHireStage.ACTIVE_DELIVERY },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      activeWorkingSince: true,
    },
  })
  if (activeProfiles.length === 0) return []

  const ids = activeProfiles.map((p) => p.id)
  const assignmentCounts = await prisma.clientAssignment.groupBy({
    by: ['rbtProfileId'],
    where: { rbtProfileId: { in: ids } },
    _count: { id: true },
    _max: { updatedAt: true },
  })
  const countByRbt = new Map(
    assignmentCounts.map((a) => [a.rbtProfileId, { count: a._count.id, lastAt: a._max.updatedAt }])
  )

  return activeProfiles
    .filter((p) => (countByRbt.get(p.id)?.count ?? 0) === 0)
    .map((p) => ({
      rbtProfileId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      activeWorkingSince: p.activeWorkingSince,
      lastAssignmentEndedAt: countByRbt.get(p.id)?.lastAt ?? null,
    }))
    .sort((a, b) => {
      const ta = a.lastAssignmentEndedAt?.getTime() ?? 0
      const tb = b.lastAssignmentEndedAt?.getTime() ?? 0
      return tb - ta
    })
}

export async function getActiveWorkingStats(): Promise<{
  activelyWorking: number
  idleHires: number
}> {
  const [activelyWorking, idleHires] = await Promise.all([
    prisma.rBTProfile.count({ where: { postHireStage: PostHireStage.ACTIVE_DELIVERY } }),
    prisma.rBTProfile.count({
      where: {
        status: 'HIRED',
        OR: [
          { postHireStage: null },
          { postHireStage: { not: PostHireStage.ACTIVE_DELIVERY } },
        ],
      },
    }),
  ])
  return { activelyWorking, idleHires }
}

export async function getAssignmentCountsByRbt(
  rbtProfileIds: string[]
): Promise<Map<string, number>> {
  if (rbtProfileIds.length === 0) return new Map()
  const rows = await prisma.clientAssignment.groupBy({
    by: ['rbtProfileId'],
    where: { rbtProfileId: { in: rbtProfileIds } },
    _count: { id: true },
  })
  return new Map(rows.map((r) => [r.rbtProfileId, r._count.id]))
}
