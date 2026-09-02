/** Canonical MCP tool names (v1 + planned v2 CRM tools). */
export const MCP_TOOL_NAMES = [
  // v1 HR
  'get_onboarding_status',
  'get_pipeline_stats',
  'find_idle_hires',
  'lookup_bt',
  'add_candidate_note',
  // v2 CRM — clients & lifecycle
  'lookup_client',
  'list_clients',
  'get_client_summary',
  'get_client_schedule',
  // v2 CRM — staffing
  'get_clients_needing_staffing',
  'get_staff_caseload',
  'find_nearest_therapists',
  'flag_staffing',
  'add_client_note',
  // v2 CRM — assessments
  'get_assessment_status',
  'list_assessments',
  // v2 CRM — compliance/docs
  'get_missing_documents',
  'get_authorizations_expiring',
  'get_reassessments_due',
  // v2 CRM — ops & email
  'get_email_activity',
  'get_weekly_summary_stats',
] as const

export type McpToolName = (typeof MCP_TOOL_NAMES)[number]

export const MCP_V1_TOOL_NAMES = [
  'get_onboarding_status',
  'get_pipeline_stats',
  'find_idle_hires',
  'lookup_bt',
  'add_candidate_note',
] as const

export type McpV1ToolName = (typeof MCP_V1_TOOL_NAMES)[number]

export function isImplementedMcpTool(name: string): name is McpV1ToolName {
  return (MCP_V1_TOOL_NAMES as readonly string[]).includes(name)
}
