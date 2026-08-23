import {
  graphEmailEnabled,
  resolveDelegatedGraphToken,
  sendMailViaGraph,
} from '@/lib/crm/emails/graphSend'
import { hasRiseAndShineMailbox } from '@/lib/crm/emails/mailbox'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export type TaskNotifySender = {
  id: string
  email: string | null
  name?: string | null
}

function staffTaskEmailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#faf8f5;color:#2c2419;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e0d4;border-radius:12px;padding:24px">
<h1 style="margin:0 0 12px;font-size:18px;color:#3d2e1f">${title}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#7a6f63">Rise &amp; Shine — internal task notification</p>
</div></body></html>`
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .trim()
}

/**
 * Internal staff task email via Microsoft Graph (same path as client CRM emails).
 * Sent from the acting staffer's mailbox to another staffer — not parent-facing.
 * When Graph is off or the sender has no token, we audit-skip (no Resend).
 */
async function notifyUser(input: {
  toUserId: string
  subject: string
  html: string
  from: TaskNotifySender
  auditAction: string
}): Promise<{ sent: boolean; reason?: string }> {
  const recipient = await prisma.user.findUnique({
    where: { id: input.toUserId },
    select: { email: true, name: true },
  })
  const to = recipient?.email?.trim().toLowerCase()
  if (!to) {
    return { sent: false, reason: 'Recipient has no email' }
  }
  if (!hasRiseAndShineMailbox(to)) {
    return { sent: false, reason: 'Recipient mailbox is not @riseandshineaba.com' }
  }

  const fromEmail = input.from.email?.trim().toLowerCase() ?? null
  if (!fromEmail || !hasRiseAndShineMailbox(fromEmail)) {
    await writeAuditLog({
      actorUserId: input.from.id,
      entityType: 'TeamTaskNotify',
      entityId: input.toUserId,
      action: 'UPDATE',
      after: { action: input.auditAction, status: 'SKIPPED', reason: 'Sender mailbox invalid' },
    })
    return { sent: false, reason: 'Sender mailbox invalid' }
  }

  if (!graphEmailEnabled()) {
    await writeAuditLog({
      actorUserId: input.from.id,
      entityType: 'TeamTaskNotify',
      entityId: input.toUserId,
      action: 'UPDATE',
      after: {
        action: input.auditAction,
        status: 'SKIPPED',
        reason: 'GRAPH_EMAIL_ENABLED is not true',
        to,
        subject: input.subject,
      },
    })
    return { sent: false, reason: 'GRAPH_EMAIL_ENABLED is not true' }
  }

  const token = await resolveDelegatedGraphToken(input.from.id)
  if (!token) {
    await writeAuditLog({
      actorUserId: input.from.id,
      entityType: 'TeamTaskNotify',
      entityId: input.toUserId,
      action: 'UPDATE',
      after: {
        action: input.auditAction,
        status: 'SKIPPED',
        reason: 'No delegated Graph token',
        to,
        subject: input.subject,
      },
    })
    return { sent: false, reason: 'No delegated Graph token' }
  }

  const html = input.html
  const delivery = await sendMailViaGraph({
    accessToken: token,
    fromAddress: fromEmail,
    to: [to],
    subject: input.subject,
    html,
    text: htmlToText(html),
  })

  await writeAuditLog({
    actorUserId: input.from.id,
    entityType: 'TeamTaskNotify',
    entityId: input.toUserId,
    action: 'UPDATE',
    after: {
      action: input.auditAction,
      status: delivery.ok ? 'SENT' : 'FAILED',
      reason: delivery.ok ? undefined : delivery.error,
      to,
      subject: input.subject,
    },
  })

  return delivery.ok
    ? { sent: true }
    : { sent: false, reason: delivery.error }
}

export async function notifyTaskAssigned(input: {
  assigneeUserId: string | null
  assignerName: string
  taskTitle: string
  clientLabel?: string | null
  dueAt?: Date | null
  from: TaskNotifySender
}): Promise<void> {
  if (!input.assigneeUserId || input.assigneeUserId === input.from.id) return
  const due = input.dueAt
    ? ` Due ${input.dueAt.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}.`
    : ''
  const client = input.clientLabel
    ? `<p><strong>Client:</strong> ${input.clientLabel}</p>`
    : ''
  await notifyUser({
    toUserId: input.assigneeUserId,
    subject: `Task assigned: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'New task assigned to you',
      `<p>${input.assignerName} assigned you: <strong>${input.taskTitle}</strong>.</p>${client}<p>${due}</p>`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_ASSIGNED',
  })
}

export async function notifyTaskCompleted(input: {
  assignerUserId: string
  completerName: string
  taskTitle: string
  from: TaskNotifySender
}): Promise<void> {
  if (input.assignerUserId === input.from.id) return
  await notifyUser({
    toUserId: input.assignerUserId,
    subject: `Task completed: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Task marked done',
      `<p>${input.completerName} completed <strong>${input.taskTitle}</strong>.</p>`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_COMPLETED',
  })
}

export async function notifyExtensionRequested(input: {
  assignerUserId: string
  requesterName: string
  taskTitle: string
  requestedDueAt: Date
  reason?: string | null
  from: TaskNotifySender
}): Promise<void> {
  if (input.assignerUserId === input.from.id) return
  const reason = input.reason?.trim()
    ? `<p><strong>Reason:</strong> ${input.reason}</p>`
    : ''
  await notifyUser({
    toUserId: input.assignerUserId,
    subject: `Extension requested: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Due-date extension requested',
      `<p>${input.requesterName} requested more time on <strong>${input.taskTitle}</strong>.</p>
<p><strong>Requested due:</strong> ${input.requestedDueAt.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</p>${reason}`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_EXTENSION',
  })
}

export async function notifyTaskMention(input: {
  mentionedUserId: string
  mentionerName: string
  taskTitle: string
  commentPreview: string
  from: TaskNotifySender
}): Promise<void> {
  if (input.mentionedUserId === input.from.id) return
  await notifyUser({
    toUserId: input.mentionedUserId,
    subject: `You were mentioned on: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'You were mentioned',
      `<p>${input.mentionerName} mentioned you on <strong>${input.taskTitle}</strong>.</p>
<p>${input.commentPreview.slice(0, 500)}</p>`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_MENTION',
  })
}

/**
 * Due-soon reminders need a sender mailbox (delegated Graph).
 * Prefer a configured ops mailbox user; otherwise skip with audit.
 */
export async function notifyTaskDueSoon(input: {
  assigneeUserId: string
  taskTitle: string
  dueAt: Date
  clientLabel?: string | null
  from: TaskNotifySender
}): Promise<void> {
  const client = input.clientLabel
    ? `<p><strong>Client:</strong> ${input.clientLabel}</p>`
    : ''
  await notifyUser({
    toUserId: input.assigneeUserId,
    subject: `Due soon: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Task due soon',
      `<p><strong>${input.taskTitle}</strong> is due ${input.dueAt.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}.</p>${client}`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_DUE_SOON',
  })
}
