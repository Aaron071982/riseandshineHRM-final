import type { ClientOwnerDept, ClientStage, Prisma, TeamTaskPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditClientAction } from '@/lib/crm/access'
import { sendGenericEmail } from '@/lib/email/core'
import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'
import { formatScheduleForBt } from '@/lib/crm/caseCoordination/scheduleString'

const CASE_COORDINATION_TASK_MARKER = '[AUTO_CASE_COORDINATION_START]'
const CLIENT_STARTED_TRIGGER_KEY = 'ACTIVE_SCHEDULE'
const SIYAM_NOTIFICATION_EMAIL = 'siyam@riseandshineaba.com'

function isCaseCoordinationStage(stage: ClientStage): boolean {
  return (
    stage === 'SCHEDULE_COORDINATION' ||
    stage === 'SCHEDULE_CONFIRMED' ||
    stage === 'PRE_START'
  )
}

function buildCaseCoordinationTaskTitle(clientName: string, clientCode: string): string {
  return `Get ${clientName} (${clientCode}) started`
}

function buildCaseCoordinationTaskDescription(): string {
  return `${CASE_COORDINATION_TASK_MARKER}
Auto-created when this client entered case coordination.

Finalize the family schedule, confirm all start logistics, and move the client to Active once services begin.`
}

function normalizeEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
}

function getStartedNotificationRecipients(): string[] {
  const fromEnv = process.env.CASE_COORDINATION_STARTED_NOTIFY_EMAILS
    ?.split(',')
    .map((email) => email.trim())
    .filter(Boolean)

  return normalizeEmails(
    fromEnv && fromEnv.length > 0
      ? fromEnv
      : [PLATFORM_OWNER_EMAIL, SIYAM_NOTIFICATION_EMAIL]
  )
}

function formatTimestamp(d: Date | null | undefined): string {
  if (!d) return 'Not set'
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

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function syncCaseCoordinationAutomation(params: {
  tx: Prisma.TransactionClient
  client: {
    id: string
    firstName: string
    lastName: string
    clientCode: string
    stage: ClientStage
    currentOwnerUserId: string | null
    caseCoordinatorUserId: string | null
  }
  toStage: ClientStage
  actorUserId: string
  now: Date
}): Promise<{
  createdTaskNotification:
    | {
        assigneeUserId: string | null
        assignedDept: ClientOwnerDept | null
        priority: TeamTaskPriority
        dueAt: Date | null
      }
    | null
}> {
  const enteringCaseCoordination =
    !isCaseCoordinationStage(params.client.stage) && isCaseCoordinationStage(params.toStage)
  const becomingActive = params.toStage === 'ACTIVE'

  let createdTaskNotification: {
    assigneeUserId: string | null
    assignedDept: ClientOwnerDept | null
    priority: TeamTaskPriority
    dueAt: Date | null
  } | null = null

  if (enteringCaseCoordination) {
    const existing = await params.tx.teamTask.findFirst({
      where: {
        serviceClientId: params.client.id,
        deletedAt: null,
        status: { not: 'DONE' },
        description: { contains: CASE_COORDINATION_TASK_MARKER },
      },
      select: { id: true },
    })

    if (!existing) {
      const clientName = `${params.client.firstName} ${params.client.lastName}`.trim()
      const assignedToUserId =
        params.client.caseCoordinatorUserId ?? params.client.currentOwnerUserId ?? null
      const assignedDept = assignedToUserId ? null : ('CASE_COORDINATION' as ClientOwnerDept)
      const dueAt = params.now

      const task = await params.tx.teamTask.create({
        data: {
          serviceClientId: params.client.id,
          title: buildCaseCoordinationTaskTitle(clientName, params.client.clientCode),
          description: buildCaseCoordinationTaskDescription(),
          status: 'TODO',
          priority: 'HIGH',
          dueAt,
          assignedToUserId,
          assignedDept,
          createdByUserId: params.actorUserId,
        },
        select: {
          id: true,
          assignedToUserId: true,
          assignedDept: true,
          priority: true,
          dueAt: true,
        },
      })

      await params.tx.teamTaskActivity.create({
        data: {
          teamTaskId: task.id,
          actorUserId: params.actorUserId,
          action: 'CREATE',
          detail: 'Auto-created for case coordination',
        },
      })

      createdTaskNotification = {
        assigneeUserId: task.assignedToUserId,
        assignedDept: task.assignedDept,
        priority: task.priority,
        dueAt: task.dueAt,
      }
    }
  }

  if (becomingActive) {
    const openTasks = await params.tx.teamTask.findMany({
      where: {
        serviceClientId: params.client.id,
        deletedAt: null,
        status: { not: 'DONE' },
        description: { contains: CASE_COORDINATION_TASK_MARKER },
      },
      select: { id: true },
    })

    if (openTasks.length > 0) {
      await params.tx.teamTask.updateMany({
        where: { id: { in: openTasks.map((task) => task.id) } },
        data: {
          status: 'DONE',
          completedAt: params.now,
          completedByUserId: params.actorUserId,
        },
      })

      await params.tx.teamTaskActivity.createMany({
        data: openTasks.map((task) => ({
          teamTaskId: task.id,
          actorUserId: params.actorUserId,
          action: 'STATUS_DONE',
          detail: 'Auto-completed when client became Active',
        })),
      })
    }
  }

  return { createdTaskNotification }
}

export async function maybeSendClientStartedScheduleEmail(
  clientId: string,
  actorUserId: string
): Promise<{ sent: boolean; reason?: string }> {
  const existing = await prisma.stageNotificationLog.findUnique({
    where: {
      serviceClientId_triggerKey: {
        serviceClientId: clientId,
        triggerKey: CLIENT_STARTED_TRIGGER_KEY,
      },
    },
  })
  if (existing) return { sent: false, reason: 'already sent' }

  const client = await prisma.serviceClient.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      actualServiceStartDate: true,
      deletedAt: true,
      scheduleAssignments: {
        where: {
          isActive: true,
          deletedAt: null,
          reviewStatus: { in: ['NONE', 'CONFIRMED'] },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          location: true,
          rbtProfile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!client || client.deletedAt) return { sent: false, reason: 'client not found' }

  const recipients = getStartedNotificationRecipients()
  if (recipients.length === 0) return { sent: false, reason: 'no recipients' }

  const clientName = `${client.firstName} ${client.lastName}`.trim()
  const groupedByRbt = new Map<
    string,
    {
      label: string
      slots: { dayOfWeek: number; startTime: string; endTime: string }[]
      locations: string[]
    }
  >()

  for (const row of client.scheduleAssignments) {
    const label = row.rbtProfile
      ? `${row.rbtProfile.firstName} ${row.rbtProfile.lastName}`.trim()
      : 'Unassigned RBT'
    const key = label || 'Unassigned RBT'
    const current = groupedByRbt.get(key) ?? { label: key, slots: [], locations: [] }
    current.slots.push({
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
    })
    if (row.location?.trim()) current.locations.push(row.location.trim())
    groupedByRbt.set(key, current)
  }

  const scheduleRows = [...groupedByRbt.values()]
    .map((group) => {
      const schedule = formatScheduleForBt(group.slots) || 'Schedule not set'
      const locations = [...new Set(group.locations)].join(', ')
      return `<tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top"><strong>${escapeHtml(group.label)}</strong></td>
        <td style="padding:8px 0;vertical-align:top">${escapeHtml(schedule)}${
          locations ? `<br /><span style="color:#555">Location: ${escapeHtml(locations)}</span>` : ''
        }</td>
      </tr>`
    })
    .join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
      <p>This client has started services.</p>
      <table style="border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Client</strong></td><td style="padding:4px 0">${escapeHtml(clientName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Client ID</strong></td><td style="padding:4px 0">${escapeHtml(client.clientCode)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><strong>Start date</strong></td><td style="padding:4px 0">${escapeHtml(formatTimestamp(client.actualServiceStartDate))}</td></tr>
      </table>
      ${
        scheduleRows
          ? `<table style="border-collapse:collapse;margin-top:16px">${scheduleRows}</table>`
          : '<p style="margin-top:16px">No confirmed schedule rows were found on the client record at send time.</p>'
      }
    </div>
  `.trim()

  let sentCount = 0
  for (const to of recipients) {
    const ok = await sendGenericEmail(
      to,
      `Client started services (${client.clientCode})`,
      html
    )
    if (ok) sentCount += 1
  }

  await prisma.stageNotificationLog.create({
    data: {
      serviceClientId: clientId,
      triggerKey: CLIENT_STARTED_TRIGGER_KEY,
      stage: 'ACTIVE',
      recipientCount: sentCount,
    },
  })

  await auditClientAction({
    userId: actorUserId,
    serviceClientId: clientId,
    action: `CASE_COORDINATION_STARTED_NOTIFY:${sentCount}`,
  })

  return { sent: sentCount > 0 }
}
