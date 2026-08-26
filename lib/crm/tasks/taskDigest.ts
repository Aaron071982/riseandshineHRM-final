import { prisma } from '@/lib/prisma'
import { makePublicUrl } from '@/lib/baseUrl'
import { hasRiseAndShineMailbox } from '@/lib/crm/emails/mailbox'
import {
  crmTaskEmailsEnabled,
  notifyUserViaResend,
  staffTaskEmailShell,
} from '@/lib/crm/tasks/notifications'

const OPEN_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED'] as const
const TASK_LIST_CAP = 10

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type TaskDigestResult = {
  eligibleUsers: number
  sent: number
  skippedEmpty: number
  failed: number
  skippedDisabled: boolean
}

/**
 * Bi-nightly CRM staff digest: unread AdminNotifications + overdue /
 * due-within-24h / open assigned TeamTasks. Resend only. No RBT recipients.
 */
export async function sendCrmTaskDigests(): Promise<TaskDigestResult> {
  if (!crmTaskEmailsEnabled()) {
    return {
      eligibleUsers: 0,
      sent: 0,
      skippedEmpty: 0,
      failed: 0,
      skippedDisabled: true,
    }
  }

  const now = new Date()
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // CRM staff = users with at least one non-revoked CrmRole
  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { not: null },
      crmRoles: { some: { revokedAt: null } },
    },
    select: { id: true, email: true, name: true },
  })

  const eligible = staff.filter((u) => hasRiseAndShineMailbox(u.email))
  let sent = 0
  let skippedEmpty = 0
  let failed = 0

  for (const user of eligible) {
    const [unreadCount, overdue, dueSoon, openAssigned] = await Promise.all([
      prisma.adminNotification.count({
        where: { userId: user.id, isRead: false },
      }),
      prisma.teamTask.findMany({
        where: {
          deletedAt: null,
          assignedToUserId: user.id,
          status: { in: [...OPEN_STATUSES] },
          dueAt: { lt: now },
        },
        orderBy: { dueAt: 'asc' },
        take: TASK_LIST_CAP,
        select: {
          id: true,
          title: true,
          dueAt: true,
          serviceClient: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.teamTask.findMany({
        where: {
          deletedAt: null,
          assignedToUserId: user.id,
          status: { in: [...OPEN_STATUSES] },
          dueAt: { gte: now, lte: soon },
        },
        orderBy: { dueAt: 'asc' },
        take: TASK_LIST_CAP,
        select: {
          id: true,
          title: true,
          dueAt: true,
          serviceClient: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.teamTask.findMany({
        where: {
          deletedAt: null,
          assignedToUserId: user.id,
          status: { in: [...OPEN_STATUSES] },
        },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: TASK_LIST_CAP,
        select: {
          id: true,
          title: true,
          dueAt: true,
          status: true,
          serviceClient: { select: { firstName: true, lastName: true } },
        },
      }),
    ])

    const openCount = await prisma.teamTask.count({
      where: {
        deletedAt: null,
        assignedToUserId: user.id,
        status: { in: [...OPEN_STATUSES] },
      },
    })

    const hasContent =
      unreadCount > 0 ||
      overdue.length > 0 ||
      dueSoon.length > 0 ||
      openCount > 0

    if (!hasContent) {
      skippedEmpty += 1
      continue
    }

    const sections: string[] = []

    if (unreadCount > 0) {
      sections.push(
        `<p><strong>${unreadCount}</strong> unread notification${unreadCount === 1 ? '' : 's'} in CRM.</p>`
      )
    }

    const taskLine = (
      t: {
        title: string
        dueAt: Date | null
        serviceClient: { firstName: string; lastName: string } | null
      },
      prefix?: string
    ) => {
      const client = t.serviceClient
        ? ` — ${escapeHtml(t.serviceClient.firstName)} ${escapeHtml(t.serviceClient.lastName)}`
        : ''
      const due = t.dueAt ? ` (due ${fmtDate(t.dueAt)})` : ''
      return `<li>${prefix ? `<em>${prefix}</em> ` : ''}${escapeHtml(t.title)}${client}${due}</li>`
    }

    if (overdue.length > 0) {
      sections.push(
        `<p><strong>Overdue (${overdue.length}${overdue.length >= TASK_LIST_CAP ? '+' : ''})</strong></p><ul>${overdue.map((t) => taskLine(t)).join('')}</ul>`
      )
    }

    if (dueSoon.length > 0) {
      sections.push(
        `<p><strong>Due within 24 hours (${dueSoon.length})</strong></p><ul>${dueSoon.map((t) => taskLine(t)).join('')}</ul>`
      )
    }

    if (openCount > 0) {
      sections.push(
        `<p><strong>Open assigned tasks (${openCount})</strong></p><ul>${openAssigned.map((t) => taskLine(t, t.status)).join('')}</ul>`
      )
    }

    const hub = makePublicUrl('/client-services/tasks')
    const html = staffTaskEmailShell(
      'Your CRM task digest',
      `<p>Hi ${escapeHtml(user.name?.trim() || 'there')},</p>${sections.join('')}<p><a href="${hub}">Open tasks hub</a></p>`
    )

    const subjectParts: string[] = []
    if (unreadCount > 0) subjectParts.push(`${unreadCount} unread`)
    if (overdue.length > 0) subjectParts.push(`${overdue.length} overdue`)
    if (dueSoon.length > 0) subjectParts.push(`${dueSoon.length} due soon`)
    if (openCount > 0 && subjectParts.length === 0) {
      subjectParts.push(`${openCount} open tasks`)
    }
    const subject = `CRM digest: ${subjectParts.join(', ') || 'task update'}`

    const result = await notifyUserViaResend({
      toUserId: user.id,
      subject,
      html,
      auditAction: 'TASK_DIGEST',
      actorUserId: null,
    })

    if (result.sent) sent += 1
    else failed += 1
  }

  return {
    eligibleUsers: eligible.length,
    sent,
    skippedEmpty,
    failed,
    skippedDisabled: false,
  }
}
