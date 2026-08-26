import {
  graphEmailEnabled,
  resolveDelegatedGraphToken,
  sendMailViaGraph,
} from '@/lib/crm/emails/graphSend'
import { hasRiseAndShineMailbox } from '@/lib/crm/emails/mailbox'
import { sendGenericEmail } from '@/lib/email/core'
import { makePublicUrl } from '@/lib/baseUrl'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export type TaskNotifySender = {
  id: string
  email: string | null
  name?: string | null
}

/** Interactive + digest task emails. Off unless CRM_TASK_EMAILS_ENABLED=true. */
export function crmTaskEmailsEnabled(): boolean {
  return process.env.CRM_TASK_EMAILS_ENABLED === 'true'
}

function tasksHubUrl(): string {
  return makePublicUrl('/client-services/tasks')
}

function staffTaskEmailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#faf8f5;color:#2c2419;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e0d4;border-radius:12px;padding:24px">
<h1 style="margin:0 0 12px;font-size:18px;color:#3d2e1f">${title}</h1>
${bodyHtml}
<p style="margin:20px 0 0"><a href="${tasksHubUrl()}" style="color:#8b5a2b">Open tasks</a></p>
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
 * Internal staff task email — Resend primary (system EMAIL_FROM).
 * Optional Graph fallback when GRAPH_EMAIL_ENABLED and sender has a delegated token.
 */
async function notifyUser(input: {
  toUserId: string
  subject: string
  html: string
  from: TaskNotifySender
  auditAction: string
}): Promise<{ sent: boolean; reason?: string }> {
  if (!crmTaskEmailsEnabled()) {
    await writeAuditLog({
      actorUserId: input.from.id,
      entityType: 'TeamTaskNotify',
      entityId: input.toUserId,
      action: 'UPDATE',
      after: {
        action: input.auditAction,
        status: 'SKIPPED',
        reason: 'CRM_TASK_EMAILS_ENABLED is not true',
      },
    })
    return { sent: false, reason: 'CRM_TASK_EMAILS_ENABLED is not true' }
  }

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

  const html = input.html

  // Primary: Resend
  if (process.env.RESEND_API_KEY) {
    const ok = await sendGenericEmail(to, input.subject, html)
    await writeAuditLog({
      actorUserId: input.from.id,
      entityType: 'TeamTaskNotify',
      entityId: input.toUserId,
      action: 'UPDATE',
      after: {
        action: input.auditAction,
        status: ok ? 'SENT' : 'FAILED',
        channel: 'RESEND',
        reason: ok ? undefined : 'Resend send failed',
        to,
        subject: input.subject,
      },
    })
    if (ok) return { sent: true }
    // Fall through to Graph if enabled
  }

  // Optional Graph fallback (delegated from assigner mailbox)
  const fromEmail = input.from.email?.trim().toLowerCase() ?? null
  if (
    !graphEmailEnabled() ||
    !fromEmail ||
    !hasRiseAndShineMailbox(fromEmail)
  ) {
    await writeAuditLog({
      actorUserId: input.from.id,
      entityType: 'TeamTaskNotify',
      entityId: input.toUserId,
      action: 'UPDATE',
      after: {
        action: input.auditAction,
        status: 'SKIPPED',
        reason: !process.env.RESEND_API_KEY
          ? 'RESEND_API_KEY missing and Graph unavailable'
          : 'Resend failed and Graph unavailable',
        to,
        subject: input.subject,
      },
    })
    return {
      sent: false,
      reason: 'Resend unavailable and Graph fallback not available',
    }
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
      channel: 'GRAPH',
      reason: delivery.ok ? undefined : delivery.error,
      to,
      subject: input.subject,
    },
  })

  return delivery.ok
    ? { sent: true }
    : { sent: false, reason: delivery.error }
}

/** System-actor notify (cron digests) — Resend only. */
export async function notifyUserViaResend(input: {
  toUserId: string
  subject: string
  html: string
  auditAction: string
  actorUserId?: string | null
}): Promise<{ sent: boolean; reason?: string }> {
  if (!crmTaskEmailsEnabled()) {
    return { sent: false, reason: 'CRM_TASK_EMAILS_ENABLED is not true' }
  }
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const recipient = await prisma.user.findUnique({
    where: { id: input.toUserId },
    select: { email: true },
  })
  const to = recipient?.email?.trim().toLowerCase()
  if (!to) return { sent: false, reason: 'Recipient has no email' }
  if (!hasRiseAndShineMailbox(to)) {
    return { sent: false, reason: 'Recipient mailbox is not @riseandshineaba.com' }
  }

  const ok = await sendGenericEmail(to, input.subject, input.html)
  await writeAuditLog({
    actorUserId: input.actorUserId ?? null,
    entityType: 'TeamTaskNotify',
    entityId: input.toUserId,
    action: 'UPDATE',
    after: {
      action: input.auditAction,
      status: ok ? 'SENT' : 'FAILED',
      channel: 'RESEND',
      to,
      subject: input.subject,
    },
  })
  return ok ? { sent: true } : { sent: false, reason: 'Resend send failed' }
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

/** Manual nudge when a task still has no conversation updates. */
export async function notifyTaskReminder(input: {
  assigneeUserId: string
  reminderFromName: string
  taskTitle: string
  clientLabel?: string | null
  dueAt?: Date | null
  from: TaskNotifySender
}): Promise<{ sent: boolean; reason?: string }> {
  if (input.assigneeUserId === input.from.id) {
    return { sent: false, reason: 'Cannot remind yourself' }
  }
  const due = input.dueAt
    ? `<p><strong>Due:</strong> ${input.dueAt.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</p>`
    : ''
  const client = input.clientLabel
    ? `<p><strong>Client:</strong> ${input.clientLabel}</p>`
    : ''
  return notifyUser({
    toUserId: input.assigneeUserId,
    subject: `Reminder: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Task reminder',
      `<p>${input.reminderFromName} sent you a reminder on <strong>${input.taskTitle}</strong>.</p>
<p>There are still no updates on this task — please take a look when you can.</p>${client}${due}`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_REMINDER',
  })
}

/**
 * @deprecated Prefer bi-nightly digest. Kept for ad-hoc use; uses Resend primary.
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

export { staffTaskEmailShell }
