import 'server-only'

import type { CrmUser } from '@/lib/crm/access'
import type { CrmRole } from '@prisma/client'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'
import { prisma } from '@/lib/prisma'

/**
 * Full-access CRM actor for MCP connector tool calls (admin-consented OAuth).
 *
 * The MCP system user (`mcp-connector@riseandshine.local`) has no CRM role
 * rows in `user_crm_roles`, so `getVisibleClientsWhere()` would fall through
 * to the claims-based filter and return zero rows for every client query.
 *
 * We bypass that by explicitly setting `fullAccess: true` and `superAdmin:
 * true` on the returned `CrmUser`. The connector runs only after an admin has
 * OAuth-consented; these flags must NOT be derived from the DB roles of the
 * system account — they represent the connector's admin-level grant.
 */
export async function getMcpCrmUser(): Promise<CrmUser> {
  const userId = await getMcpSystemUserId()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phoneNumber: true,
    },
  })
  if (!user) {
    throw new Error('MCP system user not found')
  }

  // Grant SUPER_ADMIN role so that getVisibleClientsWhere() returns all live
  // (non-deleted) clients instead of the empty claims-based deny-all.
  const mcpCrmRoles: CrmRole[] = ['SUPER_ADMIN']

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phoneNumber: user.phoneNumber,
    crmRoles: mcpCrmRoles,
    fullAccess: true,
    superAdmin: true,
  }
}
