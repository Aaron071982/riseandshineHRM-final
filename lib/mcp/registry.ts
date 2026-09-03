import { logMcpToolCall } from '@/lib/mcp/audit'
import { requireMcpAuthContext } from '@/lib/mcp/context'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/definitions'
import {
  checkToolScopeAccess,
  scopeDenialMessage,
} from '@/lib/mcp/scopes'
import { isImplementedMcpTool, type McpToolName } from '@/lib/mcp/toolNames'
import { addCandidateNote } from '@/lib/mcp/tools/addCandidateNote'
import {
  getAssessmentStatus,
  listAssessments,
} from '@/lib/mcp/tools/assessments'
import {
  addClientNote,
  getClientSchedule,
  getClientSummary,
  listClients,
  lookupClient,
} from '@/lib/mcp/tools/clients'
import { findIdleHires } from '@/lib/mcp/tools/findIdleHires'
import { getOnboardingStatus } from '@/lib/mcp/tools/getOnboardingStatus'
import { getPipelineStats } from '@/lib/mcp/tools/getPipelineStats'
import { lookupBt } from '@/lib/mcp/tools/lookupBt'
import {
  getAuthorizationsExpiring,
  getEmailActivity,
  getMissingDocuments,
  getReassessmentsDue,
  getWeeklySummaryStats,
} from '@/lib/mcp/tools/ops'
import {
  findNearestTherapists,
  flagStaffing,
  getClientsNeedingStaffingTool,
  getStaffCaseload,
} from '@/lib/mcp/tools/staffingTools'
import {
  listClientDocuments,
  readDocument,
} from '@/lib/mcp/tools/documents'
import {
  getPayrollSummary,
  getStaffPay,
  getStaffWorkedSessions,
} from '@/lib/mcp/tools/payroll'
import { logDocumentAccess } from '@/lib/mcp/documentAccess'
import { logSensitiveAccess } from '@/lib/mcp/sensitiveAccess'
import type { ToolResult } from '@/lib/mcp/types'

export { MCP_TOOL_DEFINITIONS }
export { MCP_TOOL_NAMES, type McpToolName } from '@/lib/mcp/toolNames'

async function executeTool(
  name: McpToolName,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case 'get_onboarding_status':
      return getOnboardingStatus({
        stuckOnly: args.stuckOnly === true,
        minDaysStuck: typeof args.minDaysStuck === 'number' ? args.minDaysStuck : undefined,
      })
    case 'get_pipeline_stats':
      return getPipelineStats()
    case 'find_idle_hires':
      return findIdleHires({ includeNotTrained: args.includeNotTrained === true })
    case 'lookup_bt':
      return lookupBt({ query: String(args.query ?? '') })
    case 'add_candidate_note':
      return addCandidateNote({
        rbtProfileId: String(args.rbtProfileId ?? ''),
        note: String(args.note ?? ''),
      })
    case 'lookup_client':
      return lookupClient({ query: String(args.query ?? '') })
    case 'list_clients':
      return listClients({
        stage: typeof args.stage === 'string' ? args.stage : undefined,
        state: typeof args.state === 'string' ? args.state : undefined,
        needs_staffing: args.needs_staffing === true,
        missing_docs: args.missing_docs === true,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
        cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
      })
    case 'get_client_summary':
      return getClientSummary({ client: String(args.client ?? '') })
    case 'get_client_schedule':
      return getClientSchedule({ client: String(args.client ?? '') })
    case 'get_clients_needing_staffing':
      return getClientsNeedingStaffingTool()
    case 'get_staff_caseload':
      return getStaffCaseload({ staff: String(args.staff ?? '') })
    case 'find_nearest_therapists':
      return findNearestTherapists({
        client: String(args.client ?? ''),
        only_available: args.only_available !== false,
        include_capacity: args.include_capacity !== false,
      })
    case 'flag_staffing':
      return flagStaffing({
        client: typeof args.client === 'string' ? args.client : undefined,
        rbtProfileId: typeof args.rbtProfileId === 'string' ? args.rbtProfileId : undefined,
        staff: typeof args.staff === 'string' ? args.staff : undefined,
        reason: typeof args.reason === 'string' ? args.reason : undefined,
        expected_end_date:
          typeof args.expected_end_date === 'string' ? args.expected_end_date : undefined,
        last_day: typeof args.last_day === 'string' ? args.last_day : undefined,
        departure_note:
          typeof args.departure_note === 'string' ? args.departure_note : undefined,
      })
    case 'add_client_note':
      return addClientNote({
        client: String(args.client ?? ''),
        note: String(args.note ?? ''),
      })
    case 'get_assessment_status':
      return getAssessmentStatus({ client: String(args.client ?? '') })
    case 'list_assessments':
      return listAssessments({
        status: typeof args.status === 'string' ? args.status : undefined,
        started_after: typeof args.started_after === 'string' ? args.started_after : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
        cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
      })
    case 'get_missing_documents':
      return getMissingDocuments({
        client: typeof args.client === 'string' ? args.client : undefined,
      })
    case 'get_authorizations_expiring':
      return getAuthorizationsExpiring({
        days: typeof args.days === 'number' ? args.days : undefined,
      })
    case 'get_reassessments_due':
      return getReassessmentsDue()
    case 'get_email_activity':
      return getEmailActivity({
        sender: typeof args.sender === 'string' ? args.sender : undefined,
        template: typeof args.template === 'string' ? args.template : undefined,
        client: typeof args.client === 'string' ? args.client : undefined,
        date_range:
          args.date_range === 'week_to_date' || args.date_range === 'last_full_week'
            ? args.date_range
            : undefined,
        from: typeof args.from === 'string' ? args.from : undefined,
        to: typeof args.to === 'string' ? args.to : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
        cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
      })
    case 'get_weekly_summary_stats':
      return getWeeklySummaryStats({
        week: typeof args.week === 'string' ? args.week : undefined,
      })
    case 'list_client_documents':
      return listClientDocuments({ client: String(args.client ?? '') })
    case 'read_document':
      return readDocument({
        documentId: String(args.documentId ?? ''),
        mode: typeof args.mode === 'string' ? args.mode : undefined,
      })
    case 'get_staff_pay':
      return getStaffPay({
        staff: String(args.staff ?? ''),
        date_range: typeof args.date_range === 'string' ? args.date_range : undefined,
        from: typeof args.from === 'string' ? args.from : undefined,
        to: typeof args.to === 'string' ? args.to : undefined,
        match_by: typeof args.match_by === 'string' ? args.match_by : undefined,
      })
    case 'get_staff_worked_sessions':
      return getStaffWorkedSessions({
        staff: String(args.staff ?? ''),
        date_range: typeof args.date_range === 'string' ? args.date_range : undefined,
        from: typeof args.from === 'string' ? args.from : undefined,
        to: typeof args.to === 'string' ? args.to : undefined,
      })
    case 'get_payroll_summary':
      return getPayrollSummary({
        date_range: typeof args.date_range === 'string' ? args.date_range : undefined,
        from: typeof args.from === 'string' ? args.from : undefined,
        to: typeof args.to === 'string' ? args.to : undefined,
        match_by: typeof args.match_by === 'string' ? args.match_by : undefined,
      })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const auth = requireMcpAuthContext()

  const access = checkToolScopeAccess({
    toolName: name,
    grantedScopes: auth.scopes,
    authMethod: auth.method,
  })
  if (!access.allowed) {
    const message = scopeDenialMessage(access.reason)
    await logMcpToolCall({
      toolName: name,
      args,
      resultSummary: { error: true, reason: access.reason },
      authMethod: auth.method,
      clientId: auth.clientId,
      tokenHashPrefix: auth.tokenHash?.slice(0, 8),
    })
    if (name === 'read_document') {
      await logDocumentAccess({
        userId: auth.userId,
        documentId: String(args.documentId ?? 'unknown'),
        documentType: 'unknown',
        action: 'BLOCKED_UNAUTHORIZED',
        mode: typeof args.mode === 'string' ? args.mode : 'text',
        reason: access.reason,
      })
    }
    if (
      name === 'get_staff_pay' ||
      name === 'get_staff_worked_sessions' ||
      name === 'get_payroll_summary'
    ) {
      await logSensitiveAccess({
        userId: auth.userId,
        category:
          name === 'get_staff_worked_sessions'
            ? 'WORKED_SESSIONS'
            : name === 'get_payroll_summary'
              ? 'PAYROLL'
              : 'PAY',
        action:
          access.reason === 'missing_mcp_superadmin' ||
          access.reason === 'api_key_superadmin_forbidden'
            ? 'BLOCKED_SCOPE'
            : 'BLOCKED_UNAUTHORIZED',
        toolName: name,
        reason: access.reason,
      })
    }
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }

  if (!isImplementedMcpTool(name)) {
    const message = `Tool not implemented: ${name}`
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }

  const auditMeta = {
    authMethod: auth.method,
    clientId: auth.clientId,
    tokenHashPrefix: auth.tokenHash?.slice(0, 8),
  }

  try {
    const result = await executeTool(name, args)
    await logMcpToolCall({
      toolName: name,
      args,
      resultSummary: result.summary,
      ...auditMeta,
    })
    return {
      content: [{ type: 'text', text: result.text }],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed'
    await logMcpToolCall({
      toolName: name,
      args,
      resultSummary: { error: true, message },
      ...auditMeta,
    })
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
}

export function listMcpTools() {
  return MCP_TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
}
