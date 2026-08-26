import type { CrmUser } from '@/lib/crm/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import { staffTemplateLabel } from '@/lib/crm/emails/templates'
import {
  renderWeeklyActivitySummary,
  type WeeklyActivitySummaryFields,
} from '@/lib/crm/emails/templates/weeklyActivitySummary'
import { runEmailActivity } from '@/lib/operations/reports'
import { logOpsReportRun } from '@/lib/operations/audit'

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() + diff)
  return x
}

function formatWeekRange(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(from)} – ${fmt(to)}`
}

/**
 * Payload for the internal Weekly Summary email (template #4).
 * Does NOT send — preview / cron wiring only. Sends stay behind GRAPH_EMAIL_ENABLED.
 */
export async function buildWeeklyEmailSummaryPayload(
  user: CrmUser,
  recipientList: string[] = []
): Promise<WeeklyActivitySummaryFields & { html: string; subject: string; text: string }> {
  const now = new Date()
  const thisMon = startOfWeek(now)
  const from = new Date(thisMon)
  from.setDate(from.getDate() - 7)
  const to = new Date(thisMon)
  to.setMilliseconds(-1)

  const activity = await runEmailActivity(user, {
    from,
    to,
  })

  const visible = getVisibleClientsWhere(user)

  // Pending follow-ups: welcome/consent/docs sent recently but docs still open,
  // or nudge sent with MISSING requirements still present.
  const recentComms = await prisma.clientCommunication.findMany({
    where: {
      deletedAt: null,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      template: { in: ['WELCOME', 'CONSENT_REQUEST', 'DOCS_NEEDED'] },
      sentAt: { gte: from },
      serviceClient: visible,
    },
    select: {
      template: true,
      sentAt: true,
      serviceClient: {
        select: {
          firstName: true,
          lastName: true,
          clientCode: true,
          requirements: {
            where: {
              deletedAt: null,
              status: { in: ['MISSING', 'PENDING', 'EXPIRED'] },
              type: 'DOCUMENT',
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    take: 200,
  })

  const pendingFollowups: WeeklyActivitySummaryFields['pendingFollowups'] = []
  const seen = new Set<string>()
  for (const c of recentComms) {
    const code = c.serviceClient.clientCode
    if (seen.has(code)) continue
    const hasOpenDocs = c.serviceClient.requirements.length > 0
    if (c.template === 'DOCS_NEEDED' && hasOpenDocs) {
      seen.add(code)
      pendingFollowups.push({
        clientLabel: `${c.serviceClient.firstName} ${c.serviceClient.lastName}`.trim(),
        note: 'Nudge sent but documents still outstanding',
      })
    } else if (
      (c.template === 'WELCOME' || c.template === 'CONSENT_REQUEST') &&
      hasOpenDocs
    ) {
      seen.add(code)
      pendingFollowups.push({
        clientLabel: `${c.serviceClient.firstName} ${c.serviceClient.lastName}`.trim(),
        note:
          c.template === 'WELCOME'
            ? 'Welcome sent; intake/docs not complete'
            : 'Intake & consent sent; documents still outstanding',
      })
    }
  }

  const fields: WeeklyActivitySummaryFields = {
    weekRange: formatWeekRange(from, to),
    sentCount: activity.rows.length,
    activityRows: activity.rows.map((r) => ({
      date: String(r.date ?? ''),
      sender: String(r.sender ?? ''),
      recipient: String(r.recipient ?? ''),
      template: String(r.template ?? staffTemplateLabel('MANUAL')),
      stageAtSend: String(r.stageAtSend ?? ''),
    })),
    pendingFollowups,
    recipientList,
  }

  const rendered = renderWeeklyActivitySummary(fields)

  await logOpsReportRun({
    actorUserId: user.id,
    reportKey: 'weekly-summary-preview',
    filterJson: { from, to },
    rowCount: fields.sentCount,
    kind: 'weekly_preview',
  })

  return {
    ...fields,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  }
}
