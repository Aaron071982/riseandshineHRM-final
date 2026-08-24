'use server'

import { revalidatePath } from 'next/cache'
import type {
  ClientOwnerDept,
  TeamTaskPriority,
  TeamTaskStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  auditClientAction,
  CrmAccessError,
  getClientServicesUser,
} from '@/lib/crm/access'
import {
  assertCanEditTeamTaskById,
  assertCanViewTeamTask,
  assertCanViewTeamTaskById,
  loadTeamTaskForAccess,
  teamTaskVisibilityWhere,
  userOwnerDepts,
} from '@/lib/crm/tasks/access'
import {
  assertCrmTaskAssigneeUserId,
  crmTaskAssigneeUserWhere,
} from '@/lib/crm/tasks/assignees'
import { writeAuditLog } from '@/lib/audit'
import { parseMentionIds } from '@/lib/crm/tasks/mentions'
import {
  notifyExtensionRequested,
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyTaskMention,
} from '@/lib/crm/tasks/notifications'

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string; status?: number }

function fail(err: unknown): ActionResult<never> {
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[team-tasks]', err)
  return {
    ok: false,
    error: err instanceof Error ? err.message : 'Something went wrong',
    status: 500,
  }
}

const TASK_LIST_INCLUDE = {
  assignedToUser: { select: { id: true, name: true, email: true } },
  createdByUser: { select: { id: true, name: true, email: true } },
  serviceClient: {
    select: { id: true, firstName: true, lastName: true, clientCode: true },
  },
  subtasks: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { comments: true } },
} as const

const TASK_DETAIL_INCLUDE = {
  ...TASK_LIST_INCLUDE,
  completedByUser: { select: { id: true, name: true, email: true } },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  },
  extensionRequests: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      requestedByUser: { select: { id: true, name: true, email: true } },
      reviewedByUser: { select: { id: true, name: true, email: true } },
    },
  },
  activities: {
    orderBy: { createdAt: 'desc' as const },
    take: 50,
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
} as const

async function logTaskActivity(
  taskId: string,
  actorUserId: string,
  action: string,
  detail?: string | null,
  serviceClientId?: string | null
) {
  await prisma.teamTaskActivity.create({
    data: { teamTaskId: taskId, actorUserId, action, detail: detail ?? null },
  })
  if (serviceClientId) {
    await auditClientAction({
      userId: actorUserId,
      serviceClientId,
      action: `TASK:${action}`,
    })
  }
  await writeAuditLog({
    actorUserId,
    entityType: 'TeamTask',
    entityId: taskId,
    action: 'UPDATE',
    after: { action, detail },
  })
}

function revalidateTaskPaths(clientId?: string | null) {
  revalidatePath('/client-services/tasks')
  if (clientId) revalidatePath(`/client-services/clients/${clientId}`)
}

export async function listTeamTasks(input?: {
  view?: 'my' | 'assigned_by_me' | 'team' | 'client'
  clientId?: string
  status?: TeamTaskStatus
  priority?: TeamTaskPriority
  assigneeId?: string
}) {
  try {
    const user = await getClientServicesUser()
    const view = input?.view ?? 'my'
    const baseWhere = teamTaskVisibilityWhere(user)

    let where = { ...baseWhere }

    if (view === 'my') {
      const depts = userOwnerDepts(user)
      where = {
        AND: [
          baseWhere,
          {
            status: { not: 'DONE' as const },
            OR: [
              { assignedToUserId: user.id },
              ...(depts.length
                ? [{ assignedToUserId: null, assignedDept: { in: depts } }]
                : []),
            ],
          },
        ],
      }
    } else if (view === 'assigned_by_me') {
      where = {
        AND: [
          baseWhere,
          { createdByUserId: user.id, status: { not: 'DONE' as const } },
        ],
      }
    } else if (view === 'client' && input?.clientId) {
      const { assertCanViewClient } = await import('@/lib/crm/access')
      await assertCanViewClient(user, input.clientId)
      where = {
        AND: [baseWhere, { serviceClientId: input.clientId }],
      }
    }

    if (input?.status) {
      where = { AND: [where, { status: input.status }] }
    }
    if (input?.priority) {
      where = { AND: [where, { priority: input.priority }] }
    }
    if (input?.assigneeId) {
      where = { AND: [where, { assignedToUserId: input.assigneeId }] }
    }

    const tasks = await prisma.teamTask.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      include: TASK_LIST_INCLUDE,
    })

    return { ok: true as const, tasks }
  } catch (err) {
    return fail(err)
  }
}

export async function getTeamTask(taskId: string) {
  try {
    const user = await getClientServicesUser()
    await assertCanViewTeamTaskById(user, taskId)
    const task = await prisma.teamTask.findFirst({
      where: { id: taskId, deletedAt: null },
      include: TASK_DETAIL_INCLUDE,
    })
    if (!task) return { ok: false as const, error: 'Not found', status: 404 }
    return { ok: true as const, task }
  } catch (err) {
    return fail(err)
  }
}

export async function createTeamTask(input: {
  title: string
  description?: string | null
  serviceClientId?: string | null
  assignedToUserId?: string | null
  assignedDept?: ClientOwnerDept | null
  dueAt?: string | null
  priority?: TeamTaskPriority
  subtasks?: string[]
}) {
  try {
    const user = await getClientServicesUser()
    const title = input.title.trim()
    if (!title) throw new CrmAccessError('Title is required', 400)

    if (input.serviceClientId) {
      const { assertCanEditClient } = await import('@/lib/crm/access')
      await assertCanEditClient(user, input.serviceClientId)
    }

    let assignedToUserId = input.assignedToUserId ?? null
    let assignedDept = input.assignedDept ?? null

    // Client-linked with no person: route to claim owner / CC / current owner
    if (input.serviceClientId && !assignedToUserId) {
      const {
        resolveClientTaskOwnerUserId,
      } = await import('@/lib/crm/tasks/access')
      const ownerId = await resolveClientTaskOwnerUserId(input.serviceClientId)
      if (ownerId) {
        assignedToUserId = ownerId
        assignedDept = null
      }
    }

    if (!assignedToUserId && !assignedDept) {
      throw new CrmAccessError('Assign to a person or department pool', 400)
    }

    if (assignedToUserId) {
      await assertCrmTaskAssigneeUserId(assignedToUserId)
    }

    const dueAt = input.dueAt ? new Date(input.dueAt) : null
    const subtaskTitles = (input.subtasks ?? []).map((s) => s.trim()).filter(Boolean)

    const task = await prisma.teamTask.create({
      data: {
        title,
        description: input.description?.trim() || null,
        serviceClientId: input.serviceClientId ?? null,
        assignedToUserId,
        assignedDept,
        dueAt,
        priority: input.priority ?? 'NORMAL',
        createdByUserId: user.id,
        subtasks: subtaskTitles.length
          ? {
              create: subtaskTitles.map((t, i) => ({
                title: t,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: {
        serviceClient: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    await logTaskActivity(
      task.id,
      user.id,
      'CREATE',
      title,
      task.serviceClientId
    )

    if (assignedToUserId) {
      void notifyTaskAssigned({
        assigneeUserId: assignedToUserId,
        assignerName: user.name ?? user.email ?? 'A teammate',
        taskTitle: title,
        clientLabel: task.serviceClient
          ? `${task.serviceClient.firstName} ${task.serviceClient.lastName}`
          : null,
        dueAt,
        from: { id: user.id, email: user.email ?? null, name: user.name ?? null },
      })
    }

    revalidateTaskPaths(task.serviceClientId)
    return { ok: true as const, taskId: task.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateTeamTaskStatus(
  taskId: string,
  status: TeamTaskStatus,
  blockedReason?: string | null
) {
  try {
    const user = await getClientServicesUser()
    await assertCanEditTeamTaskById(user, taskId)
    const now = new Date()

    const data: {
      status: TeamTaskStatus
      blockedReason?: string | null
      completedAt?: Date | null
      completedByUserId?: string | null
    } = { status, blockedReason: status === 'BLOCKED' ? blockedReason?.trim() || null : null }

    if (status === 'DONE') {
      data.completedAt = now
      data.completedByUserId = user.id
    } else {
      data.completedAt = null
      data.completedByUserId = null
    }

    const task = await prisma.teamTask.update({
      where: { id: taskId },
      data,
      select: {
        id: true,
        title: true,
        serviceClientId: true,
        createdByUserId: true,
      },
    })

    await logTaskActivity(
      task.id,
      user.id,
      `STATUS_${status}`,
      blockedReason ?? undefined,
      task.serviceClientId
    )

    if (status === 'DONE' && task.createdByUserId !== user.id) {
      void notifyTaskCompleted({
        assignerUserId: task.createdByUserId,
        completerName: user.name ?? user.email ?? 'Assignee',
        taskTitle: task.title,
        from: { id: user.id, email: user.email ?? null, name: user.name ?? null },
      })
    }

    revalidateTaskPaths(task.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function claimTeamTask(taskId: string) {
  try {
    const user = await getClientServicesUser()
    const task = await loadTeamTaskForAccess(taskId)
    if (!task) throw new CrmAccessError('Task not found', 404)
    await assertCanViewTeamTask(user, task)

    if (task.assignedToUserId) {
      throw new CrmAccessError('Task is already assigned', 409)
    }
    if (!task.assignedDept) {
      throw new CrmAccessError('Task is not a department pool task', 400)
    }

    const depts = userOwnerDepts(user)
    if (!depts.includes(task.assignedDept)) {
      throw new CrmAccessError('Your department cannot claim this task', 403)
    }

    if (task.serviceClientId) {
      const { assertCanEditClient } = await import('@/lib/crm/access')
      await assertCanEditClient(user, task.serviceClientId)
    }

    await prisma.teamTask.update({
      where: { id: taskId },
      data: { assignedToUserId: user.id },
    })

    await logTaskActivity(taskId, user.id, 'CLAIM', null, task.serviceClientId)
    revalidateTaskPaths(task.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function addTeamTaskSubtask(taskId: string, title: string) {
  try {
    const user = await getClientServicesUser()
    const access = await assertCanEditTeamTaskById(user, taskId)
    const trimmed = title.trim()
    if (!trimmed) throw new CrmAccessError('Subtask title required', 400)

    const max = await prisma.teamTaskSubtask.aggregate({
      where: { teamTaskId: taskId },
      _max: { sortOrder: true },
    })

    await prisma.teamTaskSubtask.create({
      data: {
        teamTaskId: taskId,
        title: trimmed,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    })

    await logTaskActivity(taskId, user.id, 'SUBTASK_ADD', trimmed, access.serviceClientId)
    revalidateTaskPaths(access.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function toggleTeamTaskSubtask(subtaskId: string, done: boolean) {
  try {
    const user = await getClientServicesUser()
    const sub = await prisma.teamTaskSubtask.findUnique({
      where: { id: subtaskId },
      include: { teamTask: { select: { id: true, serviceClientId: true } } },
    })
    if (!sub) throw new CrmAccessError('Subtask not found', 404)
    await assertCanEditTeamTaskById(user, sub.teamTaskId)

    await prisma.teamTaskSubtask.update({
      where: { id: subtaskId },
      data: { done },
    })

    await logTaskActivity(
      sub.teamTaskId,
      user.id,
      done ? 'SUBTASK_DONE' : 'SUBTASK_UNDONE',
      sub.title,
      sub.teamTask.serviceClientId
    )
    revalidateTaskPaths(sub.teamTask.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function addTeamTaskComment(taskId: string, body: string) {
  try {
    const user = await getClientServicesUser()
    const access = await assertCanViewTeamTaskById(user, taskId)
    const trimmed = body.trim()
    if (!trimmed) throw new CrmAccessError('Comment cannot be empty', 400)

    const mentions = parseMentionIds(trimmed)

    await prisma.teamTaskComment.create({
      data: {
        teamTaskId: taskId,
        authorUserId: user.id,
        body: trimmed,
        mentionsJson: mentions,
      },
    })

    await logTaskActivity(taskId, user.id, 'COMMENT', trimmed.slice(0, 200), access.serviceClientId)

    for (const mentionedId of mentions) {
      if (mentionedId === user.id) continue
      const task = await prisma.teamTask.findUnique({
        where: { id: taskId },
        select: { title: true },
      })
      if (!task) continue
      void notifyTaskMention({
        mentionedUserId: mentionedId,
        mentionerName: user.name ?? user.email ?? 'A teammate',
        taskTitle: task.title,
        commentPreview: trimmed,
        from: { id: user.id, email: user.email ?? null, name: user.name ?? null },
      })
    }

    revalidateTaskPaths(access.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function requestTeamTaskExtension(
  taskId: string,
  requestedDueAt: string,
  reason?: string | null
) {
  try {
    const user = await getClientServicesUser()
    const access = await assertCanEditTeamTaskById(user, taskId)
    const due = new Date(requestedDueAt)
    if (Number.isNaN(due.getTime())) {
      throw new CrmAccessError('Invalid due date', 400)
    }

    const task = await prisma.teamTask.findUnique({
      where: { id: taskId },
      select: { title: true, createdByUserId: true },
    })
    if (!task) throw new CrmAccessError('Task not found', 404)

    await prisma.teamTaskExtensionRequest.create({
      data: {
        teamTaskId: taskId,
        requestedByUserId: user.id,
        requestedDueAt: due,
        reason: reason?.trim() || null,
      },
    })

    await logTaskActivity(
      taskId,
      user.id,
      'EXTENSION_REQUEST',
      due.toISOString(),
      access.serviceClientId
    )

    void notifyExtensionRequested({
      assignerUserId: task.createdByUserId,
      requesterName: user.name ?? user.email ?? 'Assignee',
      taskTitle: task.title,
      requestedDueAt: due,
      reason,
      from: { id: user.id, email: user.email ?? null, name: user.name ?? null },
    })

    revalidateTaskPaths(access.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function reviewTeamTaskExtension(
  requestId: string,
  approve: boolean
) {
  try {
    const user = await getClientServicesUser()
    const req = await prisma.teamTaskExtensionRequest.findUnique({
      where: { id: requestId },
      include: {
        teamTask: {
          select: {
            id: true,
            createdByUserId: true,
            serviceClientId: true,
            title: true,
          },
        },
      },
    })
    if (!req || req.status !== 'PENDING') {
      throw new CrmAccessError('Extension request not found', 404)
    }
    if (req.teamTask.createdByUserId !== user.id) {
      const { isFullAccess, isSuperAdmin } = await import('@/lib/crm/access')
      if (!isFullAccess(user) && !isSuperAdmin(user)) {
        throw new CrmAccessError('Only the assigner can review extensions', 403)
      }
    }

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.teamTaskExtensionRequest.update({
        where: { id: requestId },
        data: {
          status: approve ? 'APPROVED' : 'DENIED',
          reviewedByUserId: user.id,
          reviewedAt: now,
        },
      })
      if (approve) {
        await tx.teamTask.update({
          where: { id: req.teamTaskId },
          data: { dueAt: req.requestedDueAt },
        })
      }
    })

    await logTaskActivity(
      req.teamTaskId,
      user.id,
      approve ? 'EXTENSION_APPROVED' : 'EXTENSION_DENIED',
      req.requestedDueAt.toISOString(),
      req.teamTask.serviceClientId
    )

    revalidateTaskPaths(req.teamTask.serviceClientId)
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

export async function searchTaskMentionUsers(query: string) {
  try {
    const user = await getClientServicesUser()
    const q = query.trim().toLowerCase()
    if (q.length < 2) return { ok: true as const, users: [] }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          crmTaskAssigneeUserWhere(),
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 8,
    })

    return { ok: true as const, users }
  } catch (err) {
    return fail(err)
  }
}
