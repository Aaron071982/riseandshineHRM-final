import { Resend } from 'resend'
import type { ClientStage, CommTemplate } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logClientAccess } from '@/lib/client-services/audit'
import { STAGE_JOURNEY_TEMPLATE } from '@/lib/crm/alertRules'
import {
  crmEmailsEnabled,
  isJourneyLockedStatus,
  resolveCrmEmailRecipient,
} from '@/lib/crm/emails/safety'
import { renderJourneyEmail } from '@/lib/crm/emails/templates'

const emailFrom = process.env.EMAIL_FROM || 'noreply@riseandshineaba.com'

export type JourneySendResult = {
  status: 'SENT' | 'SKIPPED' | 'FAILED' | 'LOCKED'
  communicationId?: string
  reason?: string
  to?: string | null
}

async function findSystemActorUserId(): Promise<string | null> {
  const emails = (
    process.env.CLIENT_SERVICES_FULL_ACCESS_EMAILS ||
    process.env.SUPER_ADMIN_EMAILS ||
    process.env.ADMIN_FALLBACK_EMAIL ||
    ''
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(emails.length
          ? [{ email: { in: emails, mode: 'insensitive' as const } }]
          : []),
        { role: { in: ['ADMIN', 'DEV'] } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return user?.id ?? null
}

async function loadMergeContext(clientId: string) {
  const client = await prisma.serviceClient.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentEmail: true,
      caseCoordinatorName: true,
      actualServiceStartDate: true,
      serviceStartDate: true,
      caseCoordinatorUser: { select: { name: true, email: true } },
      btAssignments: {
        where: { status: 'ACTIVE' },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  return client
}

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

async function deliverViaResend(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }
  const resend = new Resend(key)
  const fromAddress = emailFrom.includes('@')
    ? `"Rise & Shine ABA" <${emailFrom}>`
    : emailFrom
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: 'info@riseandshine.nyc',
    })
    if (result.error) {
      return { ok: false, error: result.error.message || 'Resend error' }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Send (or record SKIPPED) a journey email for a stage transition.
 * Idempotent: SENT/SKIPPED for the same template blocks automatic resend.
 */
export async function maybeSendJourneyEmail(
  clientId: string,
  newStage: ClientStage,
  opts?: { actorUserId?: string | null; force?: boolean }
): Promise<JourneySendResult> {
  const template = STAGE_JOURNEY_TEMPLATE[newStage]
  if (!template) {
    return { status: 'SKIPPED', reason: `No journey template for stage ${newStage}` }
  }
  return sendJourneyTemplate(clientId, template, opts)
}

export async function sendJourneyTemplate(
  clientId: string,
  template: CommTemplate,
  opts?: { actorUserId?: string | null; force?: boolean }
): Promise<JourneySendResult> {
  const client = await loadMergeContext(clientId)
  if (!client) {
    return { status: 'FAILED', reason: 'Client not found' }
  }

  if (!opts?.force) {
    const prior = await prisma.clientCommunication.findFirst({
      where: {
        serviceClientId: clientId,
        template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
      },
      orderBy: { sentAt: 'desc' },
      select: { id: true, status: true },
    })
    if (prior && isJourneyLockedStatus(prior.status)) {
      return {
        status: 'LOCKED',
        communicationId: prior.id,
        reason: `Already ${prior.status} for ${template}`,
      }
    }
  }

  const primary = client.btAssignments[0]
  const rbtName = primary?.rbtProfile
    ? `${primary.rbtProfile.firstName} ${primary.rbtProfile.lastName}`.trim()
    : null

  const rendered = renderJourneyEmail(template, {
    childFirstName: client.firstName,
    childLastName: client.lastName,
    parentName: client.parentName,
    coordinatorName:
      client.caseCoordinatorUser?.name || client.caseCoordinatorName,
    coordinatorEmail: client.caseCoordinatorUser?.email ?? null,
    rbtName,
    startDate: formatDate(
      client.actualServiceStartDate ?? client.serviceStartDate
    ),
  })

  if (!rendered) {
    return { status: 'SKIPPED', reason: `No renderer for ${template}` }
  }

  const actorUserId = opts?.actorUserId ?? (await findSystemActorUserId())
  const recipient = resolveCrmEmailRecipient(client.parentEmail)
  const now = new Date()

  // Kill-switch / no recipient → record SKIPPED (timeline visibility)
  if (!recipient.to) {
    const row = await prisma.clientCommunication.create({
      data: {
        serviceClientId: clientId,
        template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: rendered.subject,
        body: rendered.html,
        sentByUserId: actorUserId,
        sentAt: now,
        status: 'SKIPPED',
      },
    })
    if (actorUserId) {
      await logClientAccess({
        userId: actorUserId,
        serviceClientId: clientId,
        action: `JOURNEY_EMAIL_SKIPPED:${template}`,
      })
    }
    return {
      status: 'SKIPPED',
      communicationId: row.id,
      reason: recipient.reason ?? 'Send disabled',
      to: null,
    }
  }

  const delivery = await deliverViaResend({
    to: recipient.to,
    subject: recipient.redirected
      ? `[TEST → ${client.parentEmail}] ${rendered.subject}`
      : rendered.subject,
    html: rendered.html,
    text: rendered.text,
  })

  if (!delivery.ok) {
    const row = await prisma.clientCommunication.create({
      data: {
        serviceClientId: clientId,
        template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: rendered.subject,
        body: `${rendered.html}\n\n<!-- ERROR: ${delivery.error} -->`,
        sentByUserId: actorUserId,
        sentAt: now,
        status: 'FAILED',
      },
    })
    if (actorUserId) {
      await logClientAccess({
        userId: actorUserId,
        serviceClientId: clientId,
        action: `JOURNEY_EMAIL_FAILED:${template}`,
      })
    }
    return {
      status: 'FAILED',
      communicationId: row.id,
      reason: delivery.error,
      to: recipient.to,
    }
  }

  const row = await prisma.clientCommunication.create({
    data: {
      serviceClientId: clientId,
      template,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: rendered.subject,
      body: rendered.html,
      sentByUserId: actorUserId,
      sentAt: now,
      status: 'SENT',
    },
  })

  await prisma.serviceClient.update({
    where: { id: clientId },
    data: { lastParentContactAt: now },
  })

  if (actorUserId) {
    await logClientAccess({
      userId: actorUserId,
      serviceClientId: clientId,
      action: `JOURNEY_EMAIL_SENT:${template}`,
    })
  }

  return {
    status: 'SENT',
    communicationId: row.id,
    to: recipient.to,
    reason: recipient.redirected ? recipient.reason ?? undefined : undefined,
  }
}

/**
 * Retry FAILED / PENDING outbound journey emails.
 * Respects kill-switch and non-prod redirect; never duplicates SENT/SKIPPED.
 */
export async function retryFailedJourneyEmails(): Promise<{
  attempted: number
  sent: number
  failed: number
  skipped: number
}> {
  const stats = { attempted: 0, sent: 0, failed: 0, skipped: 0 }

  if (!crmEmailsEnabled()) {
    return stats
  }

  const failed = await prisma.clientCommunication.findMany({
    where: {
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      status: { in: ['FAILED', 'PENDING'] },
      template: { not: 'MANUAL' },
    },
    orderBy: { sentAt: 'asc' },
    take: 25,
    select: {
      id: true,
      serviceClientId: true,
      template: true,
    },
  })

  for (const row of failed) {
    stats.attempted++

    // If a later SENT/SKIPPED exists for same template, abandon this FAILED row
    const lock = await prisma.clientCommunication.findFirst({
      where: {
        serviceClientId: row.serviceClientId,
        template: row.template,
        status: { in: ['SENT', 'SKIPPED'] },
        id: { not: row.id },
      },
      select: { id: true },
    })
    if (lock) {
      await prisma.clientCommunication.update({
        where: { id: row.id },
        data: { status: 'SKIPPED' },
      })
      stats.skipped++
      continue
    }

    const client = await loadMergeContext(row.serviceClientId)
    if (!client) {
      stats.failed++
      continue
    }

    const rendered = renderJourneyEmail(row.template, {
      childFirstName: client.firstName,
      childLastName: client.lastName,
      parentName: client.parentName,
      coordinatorName:
        client.caseCoordinatorUser?.name || client.caseCoordinatorName,
      rbtName: client.btAssignments[0]?.rbtProfile
        ? `${client.btAssignments[0].rbtProfile.firstName} ${client.btAssignments[0].rbtProfile.lastName}`.trim()
        : null,
      startDate: formatDate(
        client.actualServiceStartDate ?? client.serviceStartDate
      ),
    })
    if (!rendered) {
      stats.skipped++
      continue
    }

    const recipient = resolveCrmEmailRecipient(client.parentEmail)
    if (!recipient.to) {
      await prisma.clientCommunication.update({
        where: { id: row.id },
        data: { status: 'SKIPPED' },
      })
      stats.skipped++
      continue
    }

    const delivery = await deliverViaResend({
      to: recipient.to,
      subject: recipient.redirected
        ? `[TEST → ${client.parentEmail}] ${rendered.subject}`
        : rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })

    if (!delivery.ok) {
      await prisma.clientCommunication.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          body: `${rendered.html}\n\n<!-- ERROR: ${delivery.error} -->`,
        },
      })
      stats.failed++
      continue
    }

    const now = new Date()
    await prisma.clientCommunication.update({
      where: { id: row.id },
      data: {
        status: 'SENT',
        subject: rendered.subject,
        body: rendered.html,
        sentAt: now,
      },
    })
    await prisma.serviceClient.update({
      where: { id: row.serviceClientId },
      data: { lastParentContactAt: now },
    })
    stats.sent++
  }

  return stats
}
