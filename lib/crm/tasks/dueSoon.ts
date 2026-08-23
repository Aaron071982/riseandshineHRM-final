import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { notifyTaskDueSoon } from '@/lib/crm/tasks/notifications'

/**
 * Send due-soon reminders for tasks due within the next 24 hours.
 * Uses Microsoft Graph from the task creator's mailbox (delegated path —
 * same as interactive assignment emails). Requires GRAPH_EMAIL_ENABLED and
 * a resolvable token for the creator (e.g. MICROSOFT_GRAPH_DELEGATED_TOKEN in cron).
 */
export async function sendDueSoonTaskReminders(): Promise<number> {
  const now = new Date()
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const tasks = await prisma.teamTask.findMany({
    where: {
      deletedAt: null,
      status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      dueAt: { gte: now, lte: soon },
      assignedToUserId: { not: null },
    },
    include: {
      serviceClient: { select: { firstName: true, lastName: true } },
      createdByUser: { select: { id: true, email: true, name: true } },
    },
  })

  let attempted = 0
  for (const task of tasks) {
    if (!task.assignedToUserId || !task.dueAt) continue
    if (!task.createdByUser?.email) {
      await writeAuditLog({
        actorUserId: task.createdByUserId,
        entityType: 'TeamTaskNotify',
        entityId: task.id,
        action: 'UPDATE',
        after: {
          action: 'TASK_NOTIFY_DUE_SOON',
          status: 'SKIPPED',
          reason: 'Creator has no email for Graph send',
        },
      })
      continue
    }
    attempted += 1
    void notifyTaskDueSoon({
      assigneeUserId: task.assignedToUserId,
      taskTitle: task.title,
      dueAt: task.dueAt,
      clientLabel: task.serviceClient
        ? `${task.serviceClient.firstName} ${task.serviceClient.lastName}`
        : null,
      from: {
        id: task.createdByUser.id,
        email: task.createdByUser.email,
        name: task.createdByUser.name,
      },
    })
  }

  return attempted
}
