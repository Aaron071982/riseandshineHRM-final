import {
  graphEmailEnabled,
  resolveDelegatedGraphToken,
  sendMailViaGraph,
} from '@/lib/crm/emails/graphSend'
import { hasRiseAndShineMailbox } from '@/lib/crm/emails/mailbox'
import {
  ACCENT,
  BODY_TEXT,
  COMPANY_NAME,
  EMAIL_LOGO_URL,
  MUTED_TEXT,
  RULE,
  ctaButton,
  escapeHtml,
} from '@/lib/crm/emails/templates/shell'
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

function formatDueLabel(dueAt: Date): string {
  return dueAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

/** Branded internal task email — logo, accent bar, solid CTA (Outlook-safe tables). */
export function staffTaskEmailShell(
  title: string,
  bodyHtml: string,
  options?: { ctaLabel?: string; ctaHref?: string }
): string {
  const ctaLabel = options?.ctaLabel ?? 'Open tasks'
  const ctaHref = options?.ctaHref ?? tasksHubUrl()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(title)} · ${COMPANY_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#faf6f1;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:${BODY_TEXT};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${RULE};box-shadow:0 2px 8px rgba(47,35,24,0.06);">
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background:${ACCENT};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid ${RULE};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:56px;padding-right:14px;">
                    <img src="${EMAIL_LOGO_URL}" alt="${COMPANY_NAME}" width="52" height="52" style="display:block;width:52px;height:52px;border:0;border-radius:12px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT};line-height:1.2;">CRM Tasks</div>
                    <div style="font-size:18px;font-weight:700;color:${BODY_TEXT};letter-spacing:-0.02em;margin-top:4px;line-height:1.25;">${COMPANY_NAME}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.3;color:${BODY_TEXT};">${escapeHtml(title)}</h1>
              <div style="font-size:15px;line-height:1.65;color:${BODY_TEXT};">
                ${bodyHtml}
              </div>
              ${ctaButton(ctaLabel, ctaHref)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED_TEXT};">
                Internal staff notification — not for forwarding outside Rise &amp; Shine.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid ${RULE};background:#fcfaf7;font-size:12px;color:${MUTED_TEXT};line-height:1.5;">
              <strong style="color:${BODY_TEXT};">${COMPANY_NAME}</strong>
              &nbsp;·&nbsp;Client Services
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function taskDetailCard(rows: { label: string; value: string }[]): string {
  const filtered = rows.filter((r) => r.value.trim())
  if (!filtered.length) return ''
  const cells = filtered
    .map(
      (r) => `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${RULE};width:110px;vertical-align:top;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};">${escapeHtml(r.label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${RULE};vertical-align:top;font-size:15px;font-weight:600;color:${BODY_TEXT};">${escapeHtml(r.value)}</td>
    </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;background:#fcfaf7;border:1px solid ${RULE};border-radius:10px;">
  <tr><td style="padding:4px 16px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells}</table>
  </td></tr>
</table>`
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
  const assigner = escapeHtml(input.assignerName.trim() || 'A teammate')
  const detail = taskDetailCard([
    { label: 'Task', value: input.taskTitle },
    ...(input.clientLabel
      ? [{ label: 'Client', value: input.clientLabel }]
      : []),
    ...(input.dueAt
      ? [{ label: 'Due', value: formatDueLabel(input.dueAt) }]
      : []),
  ])
  await notifyUser({
    toUserId: input.assigneeUserId,
    subject: `Task assigned: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'New task assigned to you',
      `<p style="margin:0 0 16px;">${assigner} assigned you a task.</p>
${detail}
<p style="margin:16px 0 0;font-size:14px;color:${MUTED_TEXT};">Open the tasks hub to update status, leave a note, or mark it done.</p>`
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
      `<p style="margin:0 0 16px;">${escapeHtml(input.completerName)} completed <strong>${escapeHtml(input.taskTitle)}</strong>.</p>
${taskDetailCard([{ label: 'Task', value: input.taskTitle }])}`
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
  await notifyUser({
    toUserId: input.assignerUserId,
    subject: `Extension requested: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Due-date extension requested',
      `<p style="margin:0 0 16px;">${escapeHtml(input.requesterName)} asked for more time on this task.</p>
${taskDetailCard([
  { label: 'Task', value: input.taskTitle },
  { label: 'Requested', value: formatDueLabel(input.requestedDueAt) },
  ...(reason ? [{ label: 'Reason', value: reason }] : []),
])}`,
      { ctaLabel: 'Review request' }
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
  const preview = escapeHtml(input.commentPreview.slice(0, 500))
  await notifyUser({
    toUserId: input.mentionedUserId,
    subject: `You were mentioned on: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'You were mentioned',
      `<p style="margin:0 0 16px;">${escapeHtml(input.mentionerName)} mentioned you on <strong>${escapeHtml(input.taskTitle)}</strong>.</p>
${taskDetailCard([{ label: 'Task', value: input.taskTitle }])}
<blockquote style="margin:16px 0 0;padding:12px 14px;border-left:3px solid ${ACCENT};background:#fcfaf7;border-radius:0 8px 8px 0;font-size:14px;line-height:1.55;color:${BODY_TEXT};">${preview}</blockquote>`,
      { ctaLabel: 'Open conversation' }
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
  return notifyUser({
    toUserId: input.assigneeUserId,
    subject: `Reminder: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Task reminder',
      `<p style="margin:0 0 16px;">${escapeHtml(input.reminderFromName)} sent you a reminder — this task still has no conversation updates.</p>
${taskDetailCard([
  { label: 'Task', value: input.taskTitle },
  ...(input.clientLabel
    ? [{ label: 'Client', value: input.clientLabel }]
    : []),
  ...(input.dueAt
    ? [{ label: 'Due', value: formatDueLabel(input.dueAt) }]
    : []),
])}`,
      { ctaLabel: 'Open task' }
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
  await notifyUser({
    toUserId: input.assigneeUserId,
    subject: `Due soon: ${input.taskTitle}`,
    html: staffTaskEmailShell(
      'Task due soon',
      `<p style="margin:0 0 16px;">This task is coming up — please review it when you can.</p>
${taskDetailCard([
  { label: 'Task', value: input.taskTitle },
  { label: 'Due', value: formatDueLabel(input.dueAt) },
  ...(input.clientLabel
    ? [{ label: 'Client', value: input.clientLabel }]
    : []),
])}`
    ),
    from: input.from,
    auditAction: 'TASK_NOTIFY_DUE_SOON',
  })
}
