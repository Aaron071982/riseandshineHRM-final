import { prisma } from '@/lib/prisma'
import { hasRiseAndShineMailbox } from '@/lib/crm/emails/mailbox'
import { MUTED_TEXT } from '@/lib/crm/emails/templates/shell'
import { makePublicUrl } from '@/lib/baseUrl'
import { easternToUTC, getEasternDate } from '@/lib/eastern-time'
import {
  getEffectiveNotificationPrefs,
  getLastDigestSentAt,
  isDigestDue,
  logTaskNotification,
} from '@/lib/crm/tasks/taskNotificationStore'
import { taskEmailsEnabled } from '@/lib/crm/tasks/taskEmailConfig'
import {
  notifyUserViaResend,
  staffTaskEmailShell,
} from '@/lib/crm/tasks/notifications'

const OPEN_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED'] as const

export type TaskDigestBuckets = {
  overdue: number
  dueToday: number
  dueThisWeek: number
  noDueDate: number
}

export type TaskDigestResult = {
  eligibleUsers: number
  dueUsers: number
  sent: number
  skippedEmpty: number
  skippedNotDue: number
  failed: number
  skippedDisabled: boolean
}

/** Messages inbox seam — AdminNotification unread count (no body PHI). */
export type MessagesDigestSeam = {
  unreadAdminNotifications: number
}

function startOfTodayUtc(now: Date): Date {
  const { year, month, day } = getEasternDate(now)
  return easternToUTC(year, month, day, 0, 0)
}

function endOfTodayUtc(now: Date): Date {
  const { year, month, day } = getEasternDate(now)
  return easternToUTC(year, month, day, 23, 59)
}

function endOfWeekUtc(now: Date): Date {
  const { year, month, day } = getEasternDate(now)
  const start = easternToUTC(year, month, day, 0, 0)
  const dayOfWeek = start.getUTCDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const endDay = new Date(start.getTime() + daysUntilSunday * 86400000)
  const endEastern = getEasternDate(endDay)
  return easternToUTC(endEastern.year, endEastern.month, endEastern.day, 23, 59)
}

export function bucketOutstandingTasks(
  tasks: { dueAt: Date | null }[],
  now = new Date()
): TaskDigestBuckets {
  const startToday = startOfTodayUtc(now)
  const endToday = endOfTodayUtc(now)
  const endWeek = endOfWeekUtc(now)

  const buckets: TaskDigestBuckets = {
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
    noDueDate: 0,
  }

  for (const t of tasks) {
    if (!t.dueAt) {
      buckets.noDueDate += 1
      continue
    }
    const due = t.dueAt
    if (due < startToday) {
      buckets.overdue += 1
    } else if (due <= endToday) {
      buckets.dueToday += 1
    } else if (due <= endWeek) {
      buckets.dueThisWeek += 1
    }
  }

  return buckets
}

function bucketListHtml(buckets: TaskDigestBuckets): string {
  const rows = [
    { label: 'Overdue', value: String(buckets.overdue) },
    { label: 'Due today', value: String(buckets.dueToday) },
    { label: 'Due this week', value: String(buckets.dueThisWeek) },
    { label: 'No due date', value: String(buckets.noDueDate) },
  ]
    .filter((r) => Number(r.value) > 0)
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;font-size:14px;color:${MUTED_TEXT};">${r.label}</td><td style="padding:8px 12px;font-size:16px;font-weight:700;text-align:right;">${r.value}</td></tr>`
    )
    .join('')

  if (!rows) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fcfaf7;border:1px solid #e8e0d8;border-radius:10px;">${rows}</table>`
}

/**
 * Nightly cron entry — per-user digest cadence from task_notification_logs.
 * Canonical task source: team_tasks (assignedToUserId, open statuses).
 * Messages seam: admin_notifications unread count when present.
 */
export async function sendCrmTaskDigests(now = new Date()): Promise<TaskDigestResult> {
  if (!taskEmailsEnabled()) {
    return {
      eligibleUsers: 0,
      dueUsers: 0,
      sent: 0,
      skippedEmpty: 0,
      skippedNotDue: 0,
      failed: 0,
      skippedDisabled: true,
    }
  }

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { not: null },
      crmRoles: { some: { revokedAt: null } },
    },
    select: { id: true, email: true },
  })

  const eligible = staff.filter((u) => hasRiseAndShineMailbox(u.email))
  let dueUsers = 0
  let sent = 0
  let skippedEmpty = 0
  let skippedNotDue = 0
  let failed = 0

  for (const user of eligible) {
    const prefs = await getEffectiveNotificationPrefs(user.id)
    if (!prefs.digestEnabled) {
      skippedNotDue += 1
      continue
    }

    const lastDigest = await getLastDigestSentAt(user.id)
    if (!isDigestDue(lastDigest, prefs.digestFrequencyNights, now)) {
      skippedNotDue += 1
      continue
    }

    dueUsers += 1

    const openTasks = await prisma.teamTask.findMany({
      where: {
        deletedAt: null,
        assignedToUserId: user.id,
        status: { in: [...OPEN_STATUSES] },
      },
      select: { dueAt: true },
    })

    const buckets = bucketOutstandingTasks(openTasks, now)
    const total =
      buckets.overdue +
      buckets.dueToday +
      buckets.dueThisWeek +
      buckets.noDueDate

    const messages: MessagesDigestSeam = {
      unreadAdminNotifications: await prisma.adminNotification.count({
        where: { userId: user.id, isRead: false },
      }),
    }

    if (total === 0 && messages.unreadAdminNotifications === 0) {
      skippedEmpty += 1
      continue
    }

    const hub = makePublicUrl('/client-services/tasks')
    const bucketHtml = bucketListHtml(buckets)
    const messagesLine =
      messages.unreadAdminNotifications > 0
        ? `<p style="margin:12px 0 0;font-size:14px;color:${MUTED_TEXT};"><strong>${messages.unreadAdminNotifications}</strong> unread in-app notification${messages.unreadAdminNotifications === 1 ? '' : 's'}.</p>`
        : ''

    const html = staffTaskEmailShell(
      'Your task digest',
      `<p style="margin:0 0 12px;">Outstanding assigned tasks (counts only — open the app for details):</p>
${bucketHtml || `<p style="margin:0;font-size:14px;color:${MUTED_TEXT};">No open assigned tasks in these buckets.</p>`}
${messagesLine}
<p style="margin:16px 0 0;font-size:14px;color:${MUTED_TEXT};">Task titles and client details are never included in email.</p>`,
      { ctaLabel: 'Open My Tasks', ctaHref: hub }
    )

    const subjectParts: string[] = []
    if (total > 0) subjectParts.push(`${total} open task${total === 1 ? '' : 's'}`)
    if (messages.unreadAdminNotifications > 0) {
      subjectParts.push(`${messages.unreadAdminNotifications} unread`)
    }
    const subject = `CRM task digest: ${subjectParts.join(' · ') || 'update'}`

    const result = await notifyUserViaResend({
      toUserId: user.id,
      subject,
      html,
      auditAction: 'TASK_DIGEST',
      actorUserId: null,
    })

    if (result.sent) {
      sent += 1
      await logTaskNotification({
        userId: user.id,
        type: 'DIGEST',
        meta: {
          ...buckets,
          total,
          unreadAdminNotifications: messages.unreadAdminNotifications,
        },
      })
    } else {
      failed += 1
    }
  }

  return {
    eligibleUsers: eligible.length,
    dueUsers,
    sent,
    skippedEmpty,
    skippedNotDue,
    failed,
    skippedDisabled: false,
  }
}
