import type { PortalNotificationType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canViewClientRecord, type CrmAccessSubject } from '@/lib/crm/access'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import {
  derivePortalLifecycle,
  type PortalLifecycleStageId,
} from '@/lib/crm/portalLifecycle'

export type PortalNotificationPayload = {
  title: string
  detail: string
  clientName: string
  therapistName?: string | null
}

export type PortalInboxItem = {
  id: string
  type: PortalNotificationType
  clientId: string
  title: string
  detail: string
  clientName: string
  readAt: string | null
  createdAt: string
}

const STAGE_TO_TYPE: Record<PortalLifecycleStageId, PortalNotificationType> = {
  INTAKE: 'CLIENT_ASSIGNED',
  AUTHORIZATION: 'IN_COORDINATION',
  READY_FOR_ASSESSMENT: 'READY_FOR_ASSESSMENT',
  THERAPIST_SEARCH: 'THERAPIST_ASSIGNED',
}

function titlesFor(
  type: PortalNotificationType,
  clientName: string,
  therapistName?: string | null
): PortalNotificationPayload {
  switch (type) {
    case 'CLIENT_ASSIGNED':
      return {
        title: 'New client assigned',
        detail: `${clientName} was assigned to you`,
        clientName,
      }
    case 'IN_COORDINATION':
      return {
        title: 'Authorization update',
        detail: `${clientName} moved into authorization`,
        clientName,
      }
    case 'READY_FOR_ASSESSMENT':
      return {
        title: 'Ready to assess',
        detail: `${clientName} is ready to assess`,
        clientName,
      }
    case 'THERAPIST_ASSIGNED':
      return {
        title: 'Therapist search',
        detail: therapistName
          ? `${therapistName} assigned to ${clientName}`
          : `${clientName} entered therapist search`,
        clientName,
        therapistName: therapistName ?? null,
      }
    default:
      return { title: 'Update', detail: clientName, clientName }
  }
}

/** Create one inbox row if this recipient+client+type does not already exist. */
export async function emitPortalNotification(input: {
  recipientUserId: string
  clientId: string
  type: PortalNotificationType
  clientName: string
  therapistName?: string | null
}): Promise<void> {
  if (!input.recipientUserId) return

  const existing = await prisma.portalNotification.findFirst({
    where: {
      recipientUserId: input.recipientUserId,
      clientId: input.clientId,
      type: input.type,
    },
    select: { id: true },
  })
  if (existing) return

  const payload = titlesFor(input.type, input.clientName, input.therapistName)
  await prisma.portalNotification.create({
    data: {
      recipientUserId: input.recipientUserId,
      clientId: input.clientId,
      type: input.type,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  })
}

/** After portal BCBA assignment — notify the newly assigned user. */
export async function emitClientAssignedNotification(input: {
  clientId: string
  assignedBcbaId: string | null
  previousAssignedBcbaId: string | null
  clientName: string
}): Promise<void> {
  if (
    !input.assignedBcbaId ||
    input.assignedBcbaId === input.previousAssignedBcbaId
  ) {
    return
  }
  await emitPortalNotification({
    recipientUserId: input.assignedBcbaId,
    clientId: input.clientId,
    type: 'CLIENT_ASSIGNED',
    clientName: input.clientName,
  })
}

/** After RBT care-team assign — notify portal BCBA if set. */
export async function emitTherapistAssignedNotification(input: {
  clientId: string
  therapistName: string
}): Promise<void> {
  const client = await prisma.serviceClient.findFirst({
    where: { id: input.clientId, ...NOT_DELETED },
    select: {
      assignedBcbaId: true,
      firstName: true,
      lastName: true,
    },
  })
  if (!client?.assignedBcbaId) return
  await emitPortalNotification({
    recipientUserId: client.assignedBcbaId,
    clientId: input.clientId,
    type: 'THERAPIST_ASSIGNED',
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    therapistName: input.therapistName,
  })
}

/** On CRM stage transition — emit coordination / ready events to assigned BCBA. */
export async function emitStageLifecycleNotifications(input: {
  clientId: string
  fromStage: string
  toStage: string
}): Promise<void> {
  const client = await prisma.serviceClient.findFirst({
    where: { id: input.clientId, ...NOT_DELETED },
    select: {
      assignedBcbaId: true,
      firstName: true,
      lastName: true,
      btAssignments: {
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!client?.assignedBcbaId) return

  const clientName = `${client.firstName} ${client.lastName}`.trim()
  const before = derivePortalLifecycle({
    stage: input.fromStage,
    hasTherapistAssigned: client.btAssignments.length > 0,
  })
  const after = derivePortalLifecycle({
    stage: input.toStage,
    hasTherapistAssigned: client.btAssignments.length > 0,
  })

  for (const stage of after.stages) {
    if (!stage.done) continue
    const wasDone = before.stages.find((s) => s.id === stage.id)?.done
    if (wasDone) continue
    // Assignment / therapist-care-team emits are handled by dedicated hooks.
    if (stage.id === 'INTAKE' || stage.id === 'THERAPIST_SEARCH') continue
    await emitPortalNotification({
      recipientUserId: client.assignedBcbaId,
      clientId: input.clientId,
      type: STAGE_TO_TYPE[stage.id],
      clientName,
    })
  }
}

export async function listPortalInbox(
  user: CrmAccessSubject,
  opts?: { limit?: number; unreadOnly?: boolean; type?: PortalNotificationType; clientId?: string }
): Promise<{ items: PortalInboxItem[]; unreadCount: number }> {
  const limit = opts?.limit ?? 50

  const where: Prisma.PortalNotificationWhereInput = {
    recipientUserId: user.id,
    ...(opts?.unreadOnly ? { readAt: null } : {}),
    ...(opts?.type ? { type: opts.type } : {}),
    ...(opts?.clientId ? { clientId: opts.clientId } : {}),
    client: {
      ...NOT_DELETED,
      // BCBA-scoped: only their assigned clients (leads see all via canView)
      ...(user.crmRoles?.includes('CLINICAL_LEAD') ||
      user.crmRoles?.includes('SUPER_ADMIN') ||
      user.crmRoles?.includes('MANAGEMENT')
        ? {}
        : { assignedBcbaId: user.id }),
    },
  }

  const [rows, unreadCount] = await Promise.all([
    prisma.portalNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        clientId: true,
        payload: true,
        readAt: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            assignedBcbaId: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.portalNotification.count({
      where: {
        recipientUserId: user.id,
        readAt: null,
        client: {
          ...NOT_DELETED,
          ...(user.crmRoles?.includes('CLINICAL_LEAD') ||
          user.crmRoles?.includes('SUPER_ADMIN') ||
          user.crmRoles?.includes('MANAGEMENT')
            ? {}
            : { assignedBcbaId: user.id }),
        },
      },
    }),
  ])

  const items: PortalInboxItem[] = []
  for (const row of rows) {
    const snapshot = {
      caseCoordinatorUserId: null as string | null,
      assignedBcbaId: row.client.assignedBcbaId,
      hasClaimGrant: false,
    }
    if (!canViewClientRecord(user, snapshot)) continue
    const payload = (row.payload ?? {}) as Partial<PortalNotificationPayload>
    const clientName =
      payload.clientName ||
      `${row.client.firstName} ${row.client.lastName}`.trim()
    items.push({
      id: row.id,
      type: row.type,
      clientId: row.clientId,
      title: payload.title || row.type,
      detail: payload.detail || clientName,
      clientName,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })
  }

  return { items, unreadCount }
}

export async function markPortalNotificationsRead(
  userId: string,
  opts: { ids?: string[]; all?: boolean }
): Promise<number> {
  const now = new Date()
  if (opts.all) {
    const res = await prisma.portalNotification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: now },
    })
    return res.count
  }
  if (!opts.ids?.length) return 0
  const res = await prisma.portalNotification.updateMany({
    where: { recipientUserId: userId, id: { in: opts.ids }, readAt: null },
    data: { readAt: now },
  })
  return res.count
}
