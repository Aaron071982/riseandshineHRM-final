import type { ClientStage, CrmRole } from '@prisma/client'
import { runtimeEnvFlag } from '@/lib/env/runtimeFlag'
import { sendGenericEmail } from '@/lib/email/core'
import { auditClientAction } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'

export const STAGE_NOTIFICATION_TRIGGERS = [
  'NEW_CLIENT',
  'CLINICAL_ASSESSMENT',
  'STAFFING',
  'ACTIVE',
] as const

export type StageNotificationTrigger = (typeof STAGE_NOTIFICATION_TRIGGERS)[number]

const STAGE_TO_TRIGGER: Partial<Record<ClientStage, StageNotificationTrigger>> = {
  ASSESSMENT: 'CLINICAL_ASSESSMENT',
  READY_FOR_STAFFING: 'STAFFING',
  ACTIVE: 'ACTIVE',
}

export function stageNotificationsEnabled(): boolean {
  return runtimeEnvFlag('STAGE_NOTIFICATIONS_ENABLED')
}

export function stageNotificationsTestSend(): boolean {
  return runtimeEnvFlag('STAGE_NOTIFICATIONS_TEST_SEND')
}

function formatNotificationTimestamp(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function formatAddedByLabel(user: {
  name: string | null
  email: string | null
} | null | undefined): string {
  if (!user) return 'Unknown user'
  const name = user.name?.trim()
  const email = user.email?.trim()
  if (name && email) return `${name} (${email})`
  return name || email || 'Unknown user'
}

export function buildNewClientNotificationEmail(input: {
  clientCode: string
  clientName: string
  addedAt: Date
  addedBy: string
}): { subject: string; html: string } {
  const subject = `New client added (${input.clientCode})`
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
      <p>A new client was added to the CRM.</p>
      <table style="border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Name</strong></td><td style="padding:4px 0">${escapeHtml(input.clientName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Client ID</strong></td><td style="padding:4px 0">${escapeHtml(input.clientCode)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Date &amp; time</strong></td><td style="padding:4px 0">${escapeHtml(formatNotificationTimestamp(input.addedAt))}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Added by</strong></td><td style="padding:4px 0">${escapeHtml(input.addedBy)}</td></tr>
      </table>
    </div>
  `.trim()
  return { subject, html }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function triggerCopy(trigger: StageNotificationTrigger): {
  subject: string
  headline: string
  tab?: string
} {
  switch (trigger) {
    case 'NEW_CLIENT':
      return {
        subject: 'New client added',
        headline: 'A new client was added to the CRM.',
      }
    case 'CLINICAL_ASSESSMENT':
      return {
        subject: 'Client ready for clinical / assessment',
        headline: 'A client is ready for clinical / assessment work.',
      }
    case 'STAFFING':
      return {
        subject: 'Client ready for staffing',
        headline: 'A client is ready for staffing.',
      }
    case 'ACTIVE':
      return {
        subject: 'Client is now active',
        headline: 'A client is now active.',
        tab: 'schedule',
      }
    default:
      return { subject: 'Client pipeline update', headline: 'Pipeline update.' }
  }
}

async function resolveRecipientEmails(
  trigger: StageNotificationTrigger
): Promise<string[]> {
  const rows = await prisma.stageNotificationRecipient.findMany({
    where: { triggerKey: trigger, enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const emails = new Set<string>()

  for (const row of rows) {
    if (row.recipientType === 'EMAIL' && row.email?.trim()) {
      emails.add(row.email.trim().toLowerCase())
      continue
    }
    if (row.recipientType === 'ROLE' && row.crmRole) {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          email: { not: null },
          crmRoles: {
            some: { role: row.crmRole as CrmRole, revokedAt: null },
          },
        },
        select: { email: true },
        take: 200,
      })
      for (const u of users) {
        if (u.email?.trim()) emails.add(u.email.trim().toLowerCase())
      }
    }
  }

  return [...emails]
}

function renderBody(params: {
  trigger: StageNotificationTrigger
  clientCode: string
  clientId: string
  clientName?: string
  addedAt?: Date
  addedBy?: string
}): { subject: string; html: string } {
  if (params.trigger === 'NEW_CLIENT' && params.clientName && params.addedAt && params.addedBy) {
    return buildNewClientNotificationEmail({
      clientCode: params.clientCode,
      clientName: params.clientName,
      addedAt: params.addedAt,
      addedBy: params.addedBy,
    })
  }

  const copy = triggerCopy(params.trigger)
  const subject = `${copy.subject} (${params.clientCode})`
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
      <p>${copy.headline}</p>
      <p><strong>Client ID:</strong> ${params.clientCode}</p>
      ${
        params.trigger === 'ACTIVE'
          ? '<p>Schedule is available on the Schedule tab in the client profile.</p>'
          : ''
      }
    </div>
  `.trim()
  return { subject, html }
}

export async function maybeSendStageNotificationForTrigger(
  clientId: string,
  trigger: StageNotificationTrigger,
  opts?: { actorUserId?: string; stage?: ClientStage }
): Promise<{ sent: boolean; reason?: string }> {
  if (!stageNotificationsEnabled()) {
    await auditClientAction({
      userId: opts?.actorUserId ?? 'system',
      serviceClientId: clientId,
      action: `STAGE_NOTIFY_SKIPPED:${trigger}:disabled`,
    })
    return { sent: false, reason: 'STAGE_NOTIFICATIONS_ENABLED is false' }
  }

  const existing = await prisma.stageNotificationLog.findUnique({
    where: {
      serviceClientId_triggerKey: {
        serviceClientId: clientId,
        triggerKey: trigger,
      },
    },
  })
  if (existing) {
    return { sent: false, reason: 'already sent' }
  }

  const client = await prisma.serviceClient.findUnique({
    where: { id: clientId },
    select: {
      clientCode: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      deletedAt: true,
      createdByUser: { select: { name: true, email: true } },
    },
  })
  if (!client || client.deletedAt) {
    return { sent: false, reason: 'client not found' }
  }

  let actorLabel = formatAddedByLabel(client.createdByUser)
  if (actorLabel === 'Unknown user' && opts?.actorUserId) {
    const actor = await prisma.user.findUnique({
      where: { id: opts.actorUserId },
      select: { name: true, email: true },
    })
    actorLabel = formatAddedByLabel(actor)
  }

  let recipients = await resolveRecipientEmails(trigger)
  if (recipients.length === 0) {
    await auditClientAction({
      userId: opts?.actorUserId ?? 'system',
      serviceClientId: clientId,
      action: `STAGE_NOTIFY_SKIPPED:${trigger}:no_recipients`,
    })
    return { sent: false, reason: 'no recipients' }
  }

  const testEmail = process.env.STAGE_NOTIFICATIONS_TEST_EMAIL?.trim()
  if (stageNotificationsTestSend() && testEmail) {
    recipients = [testEmail.toLowerCase()]
  }

  const { subject, html } = renderBody({
    trigger,
    clientCode: client.clientCode,
    clientId,
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    addedAt: client.createdAt,
    addedBy: actorLabel,
  })

  let sentCount = 0
  for (const to of recipients) {
    const ok = await sendGenericEmail(to, subject, html)
    if (ok) sentCount += 1
  }

  await prisma.stageNotificationLog.create({
    data: {
      serviceClientId: clientId,
      triggerKey: trigger,
      stage: opts?.stage ?? null,
      recipientCount: sentCount,
    },
  })

  await auditClientAction({
    userId: opts?.actorUserId ?? 'system',
    serviceClientId: clientId,
    action: `STAGE_NOTIFY_SENT:${trigger}:${sentCount}`,
  })

  return { sent: sentCount > 0 }
}

export async function notifyNewClientCreated(
  clientId: string,
  actorUserId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    return await maybeSendStageNotificationForTrigger(clientId, 'NEW_CLIENT', {
      actorUserId,
    })
  } catch (err) {
    console.error('[crm] new-client notification failed', err)
    return { sent: false, reason: 'send failed' }
  }
}

export async function maybeSendStageNotification(
  clientId: string,
  stage: ClientStage,
  opts?: { actorUserId?: string }
): Promise<void> {
  const trigger = STAGE_TO_TRIGGER[stage]
  if (!trigger) return
  await maybeSendStageNotificationForTrigger(clientId, trigger, {
    actorUserId: opts?.actorUserId,
    stage,
  })
}
