import 'server-only'

import type { CommTemplate } from '@prisma/client'
import { getMcpCrmUser } from '@/lib/mcp/crmUser'
import { reportToToolResult } from '@/lib/mcp/format'
import type { ToolResult } from '@/lib/mcp/types'
import {
  executeReport,
  type EmailActivityFilters,
} from '@/lib/operations/reports'
import { buildWeeklyEmailSummaryPayload } from '@/lib/operations/weeklySummary'
import { loadManagerDashboard } from '@/lib/crm/dashboard'

export async function getMissingDocuments(args: {
  client?: string
}): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  let report = await executeReport(user, 'missing-documents')

  if (args.client?.trim()) {
    const q = args.client.trim().toLowerCase()
    report = {
      ...report,
      rows: report.rows.filter((row) => {
        const id = String(row.clientId ?? row.id ?? '').toLowerCase()
        const code = String(row.clientCode ?? '').toLowerCase()
        const name = String(row.client ?? row.clientName ?? '').toLowerCase()
        return id === q || code === q || name.includes(q)
      }),
    }
  }

  return reportToToolResult(report)
}

export async function getAuthorizationsExpiring(args: {
  days?: number
}): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  const report = await executeReport(user, 'authorizations-expiring')
  const maxDays = args.days ?? 30

  const filtered = {
    ...report,
    rows: report.rows.filter((row) => {
      const d = row.daysUntilExpiry ?? row.days
      if (typeof d === 'number') return d <= maxDays
      return true
    }),
    summary: `${report.summary} (filtered to ${maxDays} days)`,
  }

  return reportToToolResult(filtered)
}

export async function getReassessmentsDue(): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  const report = await executeReport(user, 'reassessments-due')
  return reportToToolResult(report)
}

export async function getEmailActivity(args: {
  sender?: string
  template?: string
  client?: string
  date_range?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  const filters: EmailActivityFilters = {}

  if (args.template?.trim()) {
    filters.template = args.template.trim().toUpperCase() as CommTemplate
  }
  if (args.client?.trim()) {
    filters.clientId = args.client.trim()
  }
  if (args.sender?.trim()) {
    filters.senderUserId = args.sender.trim()
  }
  if (args.date_range === 'week_to_date' || args.date_range === 'last_full_week') {
    filters.quickRange = args.date_range
  }
  if (args.from) filters.from = args.from
  if (args.to) filters.to = args.to

  const report = await executeReport(user, 'email-activity', filters)
  const limit = Math.min(args.limit ?? 50, 100)
  const offset = args.cursor ? parseInt(args.cursor, 10) || 0 : 0
  const rows = report.rows.slice(offset, offset + limit)

  const trimmed = {
    ...report,
    rows,
    summary: `${report.summary} Showing ${rows.length} of ${report.rows.length}.`,
  }

  const result = reportToToolResult(trimmed)
  return {
    ...result,
    summary: {
      ...result.summary,
      nextCursor:
        offset + rows.length < report.rows.length
          ? String(offset + rows.length)
          : null,
    },
  }
}

export async function getWeeklySummaryStats(args: {
  week?: string
}): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  const [emailPayload, dashboard] = await Promise.all([
    buildWeeklyEmailSummaryPayload(user),
    loadManagerDashboard(user),
  ])

  const payload = {
    week: args.week ?? emailPayload.weekRange,
    email: {
      sentCount: emailPayload.sentCount,
      pendingFollowups: emailPayload.pendingFollowups?.length ?? 0,
      activityPreview: emailPayload.activityRows?.slice(0, 10) ?? [],
    },
    clients: {
      needsAttention: dashboard.kpis.needsAttention,
      inPipeline: dashboard.kpis.inPipeline,
      activeClients: dashboard.kpis.activeClients,
      pipelineByStage: dashboard.pipeline.byStage.filter((s) => s.count > 0),
    },
    queues: dashboard.queues,
  }

  return {
    text: `# Weekly summary\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
    summary: {
      sentCount: emailPayload.sentCount,
      needsAttention: dashboard.kpis.needsAttention,
      activeClients: dashboard.kpis.activeClients,
    },
  }
}
