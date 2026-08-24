import type { ClientOwnerDept, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  assertCanEditClient,
  assertCanViewClient,
  CrmAccessError,
  getUserCrmRoles,
  getVisibleClientsWhere,
  isFullAccess,
  isSuperAdmin,
  type CrmAccessSubject,
  type CrmUser,
} from '@/lib/crm/access'
import { CRM_ROLE_TO_OWNER_DEPT } from '@/lib/crm/roleConstants'
import { NOT_DELETED } from '@/lib/crm/softDelete'

export { isMyTeamTask } from '@/lib/crm/tasks/myTasks'

export function userOwnerDepts(user: CrmAccessSubject): ClientOwnerDept[] {
  const roles = getUserCrmRoles(user)
  const depts = roles
    .map((r) => CRM_ROLE_TO_OWNER_DEPT[r])
    .filter((d): d is ClientOwnerDept => !!d)
  return [...new Set(depts)]
}

/**
 * Clients this user actively owns for task routing:
 * active claim, case coordinator, or current department owner.
 */
export async function loadOwnedClientIds(userId: string): Promise<string[]> {
  const [claims, owned] = await Promise.all([
    prisma.clientClaim.findMany({
      where: { userId, releasedAt: null },
      select: { serviceClientId: true },
    }),
    prisma.serviceClient.findMany({
      where: {
        ...NOT_DELETED,
        OR: [
          { caseCoordinatorUserId: userId },
          { currentOwnerUserId: userId },
        ],
      },
      select: { id: true },
    }),
  ])
  return [
    ...new Set([
      ...claims.map((c) => c.serviceClientId),
      ...owned.map((c) => c.id),
    ]),
  ]
}

/** Prefer current owner → case coordinator → active claim holder for a client. */
export async function resolveClientTaskOwnerUserId(
  serviceClientId: string
): Promise<string | null> {
  const client = await prisma.serviceClient.findFirst({
    where: { id: serviceClientId, ...NOT_DELETED },
    select: {
      currentOwnerUserId: true,
      caseCoordinatorUserId: true,
      claims: {
        where: { releasedAt: null },
        orderBy: { claimedAt: 'desc' },
        take: 1,
        select: { userId: true },
      },
    },
  })
  if (!client) return null
  return (
    client.currentOwnerUserId ??
    client.caseCoordinatorUserId ??
    client.claims[0]?.userId ??
    null
  )
}

/** Tasks visible to this user (claim-scoped for client-linked). */
export function teamTaskVisibilityWhere(
  user: CrmAccessSubject
): Prisma.TeamTaskWhereInput {
  if (isFullAccess(user) || isSuperAdmin(user)) {
    return { deletedAt: null }
  }

  const depts = userOwnerDepts(user)
  const userId = user.id
  if (!userId) return { id: { in: [] } }

  return {
    deletedAt: null,
    OR: [
      {
        serviceClientId: null,
        OR: [
          { assignedToUserId: userId },
          { createdByUserId: userId },
          ...(depts.length
            ? [{ assignedToUserId: null, assignedDept: { in: depts } }]
            : []),
        ],
      },
      {
        serviceClientId: { not: null },
        serviceClient: { is: getVisibleClientsWhere(user) },
      },
    ],
  }
}

export type TeamTaskAccessRow = {
  id: string
  serviceClientId: string | null
  assignedToUserId: string | null
  assignedDept: ClientOwnerDept | null
  createdByUserId: string
}

export async function loadTeamTaskForAccess(
  taskId: string
): Promise<TeamTaskAccessRow | null> {
  return prisma.teamTask.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      serviceClientId: true,
      assignedToUserId: true,
      assignedDept: true,
      createdByUserId: true,
    },
  })
}

export async function assertCanViewTeamTask(
  user: CrmUser,
  task: TeamTaskAccessRow
): Promise<void> {
  if (isFullAccess(user) || isSuperAdmin(user)) return

  if (task.serviceClientId) {
    await assertCanViewClient(user, task.serviceClientId)
    return
  }

  const depts = userOwnerDepts(user)
  const involved =
    task.assignedToUserId === user.id ||
    task.createdByUserId === user.id ||
    (task.assignedToUserId == null &&
      task.assignedDept != null &&
      depts.includes(task.assignedDept))

  if (!involved) {
    throw new CrmAccessError('Forbidden', 403)
  }
}

export async function assertCanEditTeamTask(
  user: CrmUser,
  task: TeamTaskAccessRow
): Promise<void> {
  await assertCanViewTeamTask(user, task)

  if (isFullAccess(user) || isSuperAdmin(user)) return

  if (task.serviceClientId) {
    await assertCanEditClient(user, task.serviceClientId)
  }

  const depts = userOwnerDepts(user)
  const ownsClient =
    task.serviceClientId != null &&
    (await loadOwnedClientIds(user.id)).includes(task.serviceClientId)

  const canAct =
    task.assignedToUserId === user.id ||
    task.createdByUserId === user.id ||
    ownsClient ||
    (task.assignedToUserId == null &&
      task.assignedDept != null &&
      depts.includes(task.assignedDept))

  if (!canAct) {
    throw new CrmAccessError('You cannot edit this task', 403)
  }
}

export async function assertCanViewTeamTaskById(
  user: CrmUser,
  taskId: string
): Promise<TeamTaskAccessRow> {
  const task = await loadTeamTaskForAccess(taskId)
  if (!task) throw new CrmAccessError('Task not found', 404)
  await assertCanViewTeamTask(user, task)
  return task
}

export async function assertCanEditTeamTaskById(
  user: CrmUser,
  taskId: string
): Promise<TeamTaskAccessRow> {
  const task = await assertCanViewTeamTaskById(user, taskId)
  await assertCanEditTeamTask(user, task)
  return task
}

/** Change task details or delete — creator, client editor, or full access. */
export async function assertCanManageTeamTask(
  user: CrmUser,
  task: TeamTaskAccessRow
): Promise<void> {
  await assertCanViewTeamTask(user, task)
  if (isFullAccess(user) || isSuperAdmin(user)) return
  if (task.createdByUserId === user.id) return
  if (task.serviceClientId) {
    try {
      await assertCanEditClient(user, task.serviceClientId)
      return
    } catch {
      // fall through
    }
  }
  throw new CrmAccessError('You cannot edit or delete this task', 403)
}

export async function assertCanManageTeamTaskById(
  user: CrmUser,
  taskId: string
): Promise<TeamTaskAccessRow> {
  const task = await assertCanViewTeamTaskById(user, taskId)
  await assertCanManageTeamTask(user, task)
  return task
}
