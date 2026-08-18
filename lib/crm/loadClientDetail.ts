import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  assertCanViewClient,
  auditClientAction,
  getClientServicesUser,
  getVisibleClientsWhere,
  type CrmUser,
} from '@/lib/crm/access'
import { canAdvance, stageIndex } from '@/lib/crm/stages'
import { hoursBetween } from '@/lib/rbt-schedule/utils'

export async function loadClientCrmDetail(clientId: string) {
  const user = await getClientServicesUser()
  await assertCanViewClient(user, clientId)

  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    include: {
      requirements: { orderBy: [{ stage: 'asc' }, { key: 'asc' }] },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          changedByUser: { select: { id: true, name: true, email: true } },
        },
      },
      clientNotes: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      bcbaProfile: { select: { id: true, fullName: true, email: true } },
      caseCoordinatorUser: { select: { id: true, name: true, email: true } },
      currentOwnerUser: { select: { id: true, name: true, email: true } },
      accessLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      authorizations: {
        orderBy: { createdAt: 'desc' },
        include: { lines: { orderBy: { cptCode: 'asc' } } },
      },
      btAssignments: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        include: {
          rbtProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
            },
          },
        },
      },
      scheduleAssignments: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          rbtProfile: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      communications: {
        orderBy: { sentAt: 'desc' },
        take: 100,
        include: {
          sentByUser: { select: { id: true, name: true, email: true } },
        },
      },
      rbtBreaks: {
        where: { status: 'ON_BREAK' },
        orderBy: { createdAt: 'desc' },
      },
      alerts: {
        where: { resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!client) notFound()

  await auditClientAction({
    userId: user.id,
    serviceClientId: client.id,
    action: 'VIEW',
  })

  const gate = canAdvance(
    {
      stage: client.stage,
      treatmentPlanStatus: client.treatmentPlanStatus,
    },
    client.requirements
  )
  const daysInStage = daysSince(client.stageEnteredAt)
  const weeklyScheduleHours = client.scheduleAssignments.reduce(
    (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
    0
  )

  return {
    user,
    client,
    gate,
    daysInStage,
    weeklyScheduleHours,
    canOverrideStage: user.fullAccess,
    stageNumber: stageIndex(client.stage) + 1,
  }
}

export function daysSince(from: Date | null | undefined): number | null {
  if (!from) return null
  const ms = Date.now() - from.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

export type ClientCrmDetailData = Awaited<ReturnType<typeof loadClientCrmDetail>>
export type ClientCrmUser = CrmUser
