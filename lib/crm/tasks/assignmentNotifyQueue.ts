import type { TeamTaskPriority } from '@prisma/client'
import {
  getEffectiveNotificationPrefs,
  logTaskNotification,
  taskEmailCategory,
} from '@/lib/crm/tasks/taskNotificationStore'
import {
  notifyUserViaResend,
  staffTaskEmailShell,
} from '@/lib/crm/tasks/notifications'
import { MUTED_TEXT } from '@/lib/crm/emails/templates/shell'
import { makePublicUrl } from '@/lib/baseUrl'

const DEBOUNCE_MS = 1500

export type AssignmentNotifyItem = {
  assigneeUserId: string
  actorUserId: string
  category: string
  dueAt: Date | null
}

type PendingBatch = {
  items: AssignmentNotifyItem[]
  timer: ReturnType<typeof setTimeout> | null
}

const pendingByAssignee = new Map<string, PendingBatch>()

function formatDueLabel(dueAt: Date): string {
  return dueAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

function tasksHubUrl(): string {
  return makePublicUrl('/client-services/tasks')
}

function bucketCard(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;font-size:12px;font-weight:700;text-transform:uppercase;color:${MUTED_TEXT};width:120px;">${r.label}</td><td style="padding:8px 0;font-size:15px;font-weight:600;">${r.value}</td></tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;background:#fcfaf7;border:1px solid #e8e0d8;border-radius:10px;"><tr><td style="padding:8px 16px;"><table role="presentation" width="100%">${cells}</table></td></tr></table>`
}

async function sendAssignmentBatch(
  assigneeUserId: string,
  items: AssignmentNotifyItem[]
): Promise<void> {
  if (items.length === 0) return

  const actorUserId = items[0]!.actorUserId
  const prefs = await getEffectiveNotificationPrefs(assigneeUserId)
  if (!prefs.assignmentEmails) return

  const count = items.length
  const categories = [...new Set(items.map((i) => i.category))]
  const dueDates = [
    ...new Set(
      items
        .filter((i) => i.dueAt)
        .map((i) => formatDueLabel(i.dueAt!))
    ),
  ]

  const title =
    count === 1 ? 'New task assigned to you' : `${count} new tasks assigned to you`

  const detailRows: { label: string; value: string }[] = [
    {
      label: 'Type',
      value:
        categories.length === 1
          ? categories[0]!
          : `${categories.length} task categories`,
    },
  ]
  if (count === 1 && items[0]!.dueAt) {
    detailRows.push({ label: 'Due', value: formatDueLabel(items[0]!.dueAt!) })
  } else if (dueDates.length === 1) {
    detailRows.push({ label: 'Due', value: dueDates[0]! })
  } else if (dueDates.length > 1) {
    detailRows.push({ label: 'Due', value: 'Multiple due dates' })
  }

  const subject =
    count === 1 ? 'New CRM task assigned to you' : `${count} new CRM tasks assigned to you`

  const html = staffTaskEmailShell(
    title,
    `<p style="margin:0 0 12px;">You have ${count === 1 ? 'a new assignment' : `${count} new assignments`} in Client Services.</p>
${bucketCard(detailRows)}
<p style="margin:12px 0 0;font-size:14px;color:${MUTED_TEXT};">Open My Tasks for details — task titles and client information stay in the secure app.</p>`,
    { ctaLabel: 'Open My Tasks', ctaHref: tasksHubUrl() }
  )

  const result = await notifyUserViaResend({
    toUserId: assigneeUserId,
    subject,
    html,
    auditAction: count === 1 ? 'TASK_NOTIFY_ASSIGNED' : 'TASK_NOTIFY_ASSIGNED_BATCH',
    actorUserId,
  })

  if (result.sent) {
    await logTaskNotification({
      userId: assigneeUserId,
      type: 'ASSIGNMENT',
      meta: {
        count,
        categories,
        dueDateCount: dueDates.length,
      },
    })
  }
}

export function queueAssignmentNotification(input: {
  assigneeUserId: string | null
  actorUserId: string
  serviceClientId: string | null
  assignedDept: import('@prisma/client').ClientOwnerDept | null
  priority: TeamTaskPriority
  dueAt?: Date | null
}): void {
  const assigneeUserId = input.assigneeUserId
  if (!assigneeUserId || assigneeUserId === input.actorUserId) return

  const item: AssignmentNotifyItem = {
    assigneeUserId,
    actorUserId: input.actorUserId,
    category: taskEmailCategory({
      serviceClientId: input.serviceClientId,
      assignedDept: input.assignedDept,
      priority: input.priority,
    }),
    dueAt: input.dueAt ?? null,
  }

  let batch = pendingByAssignee.get(assigneeUserId)
  if (!batch) {
    batch = { items: [], timer: null }
    pendingByAssignee.set(assigneeUserId, batch)
  }
  batch.items.push(item)

  if (batch.timer) clearTimeout(batch.timer)
  batch.timer = setTimeout(() => {
    const current = pendingByAssignee.get(assigneeUserId)
    pendingByAssignee.delete(assigneeUserId)
    if (!current?.items.length) return
    void sendAssignmentBatch(assigneeUserId, current.items)
  }, DEBOUNCE_MS)
}

/** Test hook — flush pending assignment batches immediately. */
export async function flushAssignmentNotificationQueue(): Promise<void> {
  const entries = [...pendingByAssignee.entries()]
  pendingByAssignee.clear()
  for (const [userId, batch] of entries) {
    if (batch.timer) clearTimeout(batch.timer)
    await sendAssignmentBatch(userId, batch.items)
  }
}
