/** Canonical MCP tool names (v1 HR + v2 CRM). */
export const MCP_TOOL_NAMES = [
  'get_onboarding_status',
  'get_pipeline_stats',
  'find_idle_hires',
  'lookup_bt',
  'add_candidate_note',
  'lookup_client',
  'list_clients',
  'get_client_summary',
  'get_client_schedule',
  'get_clients_needing_staffing',
  'get_staff_caseload',
  'find_nearest_therapists',
  'flag_staffing',
  'add_client_note',
  'get_assessment_status',
  'list_assessments',
  'get_missing_documents',
  'get_authorizations_expiring',
  'get_reassessments_due',
  'get_email_activity',
  'get_weekly_summary_stats',
  'list_client_documents',
  'read_document',
  'get_staff_pay',
  'get_staff_worked_sessions',
  'get_payroll_summary',
] as const

export type McpToolName = (typeof MCP_TOOL_NAMES)[number]

export function isImplementedMcpTool(name: string): name is McpToolName {
  return (MCP_TOOL_NAMES as readonly string[]).includes(name)
}
