import type { McpToolName } from '@/lib/mcp/toolNames'

/** OAuth scopes for the MCP connector. */
export const MCP_SCOPE_READ = 'mcp:read'
export const MCP_SCOPE_WRITE = 'mcp:write'
export const MCP_SCOPE_PHI = 'mcp:phi'

/** Default scopes requested during OAuth (includes PHI for admin CRM use). */
export const MCP_OAUTH_SCOPES = [
  MCP_SCOPE_READ,
  MCP_SCOPE_WRITE,
  MCP_SCOPE_PHI,
] as const

export const MCP_OAUTH_SCOPE_STRING = MCP_OAUTH_SCOPES.join(' ')

/** Scopes granted to the static MCP_API_KEY dev fallback (HR tools only). */
export const MCP_API_KEY_SCOPES = [MCP_SCOPE_READ, MCP_SCOPE_WRITE] as const

export type McpToolAccessRule = {
  requiresPhi: boolean
  requiresWrite: boolean
}

/**
 * Access rules per tool. CRM tools are listed here for v2 gating even before
 * implementations land in registry.ts.
 */
export const MCP_TOOL_ACCESS: Record<McpToolName | string, McpToolAccessRule> = {
  // --- v1 HR tools (mcp:read / mcp:write only) ---
  get_onboarding_status: { requiresPhi: false, requiresWrite: false },
  get_pipeline_stats: { requiresPhi: false, requiresWrite: false },
  find_idle_hires: { requiresPhi: false, requiresWrite: false },
  lookup_bt: { requiresPhi: false, requiresWrite: false },
  add_candidate_note: { requiresPhi: false, requiresWrite: true },

  // --- v2 CRM read tools (mcp:phi) ---
  lookup_client: { requiresPhi: true, requiresWrite: false },
  list_clients: { requiresPhi: true, requiresWrite: false },
  get_client_summary: { requiresPhi: true, requiresWrite: false },
  get_client_schedule: { requiresPhi: true, requiresWrite: false },
  get_clients_needing_staffing: { requiresPhi: true, requiresWrite: false },
  get_staff_caseload: { requiresPhi: true, requiresWrite: false },
  find_nearest_therapists: { requiresPhi: true, requiresWrite: false },
  get_assessment_status: { requiresPhi: true, requiresWrite: false },
  list_assessments: { requiresPhi: true, requiresWrite: false },
  get_missing_documents: { requiresPhi: true, requiresWrite: false },
  get_authorizations_expiring: { requiresPhi: true, requiresWrite: false },
  get_reassessments_due: { requiresPhi: true, requiresWrite: false },
  get_email_activity: { requiresPhi: true, requiresWrite: false },
  get_weekly_summary_stats: { requiresPhi: true, requiresWrite: false },

  // --- v2 CRM write tools (mcp:phi + mcp:write) ---
  flag_staffing: { requiresPhi: true, requiresWrite: true },
  add_client_note: { requiresPhi: true, requiresWrite: true },
}

export function parseOAuthScopes(scope: string | null | undefined): Set<string> {
  return new Set(
    (scope ?? '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

export function getToolAccessRule(toolName: string): McpToolAccessRule {
  return (
    MCP_TOOL_ACCESS[toolName] ?? {
      requiresPhi: true,
      requiresWrite: false,
    }
  )
}

export type McpScopeDenialReason =
  | 'unknown_tool'
  | 'api_key_phi_forbidden'
  | 'missing_mcp_read'
  | 'missing_mcp_phi'
  | 'missing_mcp_write'

export function checkToolScopeAccess(input: {
  toolName: string
  grantedScopes: Set<string>
  authMethod: 'oauth' | 'api_key'
}): { allowed: true } | { allowed: false; reason: McpScopeDenialReason } {
  const rule = MCP_TOOL_ACCESS[input.toolName]
  if (!rule) {
    return { allowed: false, reason: 'unknown_tool' }
  }

  if (rule.requiresPhi && input.authMethod === 'api_key') {
    return { allowed: false, reason: 'api_key_phi_forbidden' }
  }

  const needsRead = !rule.requiresWrite || rule.requiresPhi
  if (needsRead && !input.grantedScopes.has(MCP_SCOPE_READ)) {
    return { allowed: false, reason: 'missing_mcp_read' }
  }

  if (rule.requiresPhi && !input.grantedScopes.has(MCP_SCOPE_PHI)) {
    return { allowed: false, reason: 'missing_mcp_phi' }
  }

  if (rule.requiresWrite && !input.grantedScopes.has(MCP_SCOPE_WRITE)) {
    return { allowed: false, reason: 'missing_mcp_write' }
  }

  return { allowed: true }
}

export function scopeDenialMessage(reason: McpScopeDenialReason): string {
  switch (reason) {
    case 'api_key_phi_forbidden':
      return 'This tool returns client PHI and requires OAuth with the mcp:phi scope. The static MCP_API_KEY cannot access PHI tools.'
    case 'missing_mcp_phi':
      return 'This tool requires the mcp:phi scope. Re-authorize the connector and approve client data access.'
    case 'missing_mcp_write':
      return 'This tool requires the mcp:write scope.'
    case 'missing_mcp_read':
      return 'This tool requires the mcp:read scope.'
    default:
      return 'Tool not allowed.'
  }
}
