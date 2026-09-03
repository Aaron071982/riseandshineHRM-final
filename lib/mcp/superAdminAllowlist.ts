/**
 * Hardcoded MCP super-admin emails (pay/comp tier).
 * Also mirrored by User.mcp_super_admin flag for admin toggles.
 */
export const MCP_SUPERADMIN_EMAILS = [
  'irsal@riseandshineaba.com',
  'kazi@riseandshineaba.com',
  'siyam@riseandshineaba.com',
  'shazia@riseandshineaba.com',
  'fardeen@riseandshineaba.com',
] as const

export type McpSuperAdminSubject = {
  id: string
  email?: string | null
  isMcpSuperAdmin?: boolean | null
}

export function isMcpSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return (MCP_SUPERADMIN_EMAILS as readonly string[]).includes(normalized)
}

/**
 * Gate 2 for mcp:superadmin tools: named allowlist.
 * True when the explicit flag is set OR the email is one of the five executives.
 */
export function userIsMcpSuperAdmin(user: McpSuperAdminSubject | null | undefined): boolean {
  if (!user?.id) return false
  if (user.isMcpSuperAdmin === true) return true
  return isMcpSuperAdminEmail(user.email)
}

export const MCP_SUPERADMIN_UNAUTHORIZED_MESSAGE =
  'Not authorized for super-admin MCP tools (pay/compensation). Limited to a named allowlist of five executives.'
