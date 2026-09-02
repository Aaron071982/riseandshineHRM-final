import 'server-only'

import type { CrmUser } from '@/lib/crm/access'
import { fetchUserCrmRoles, isFullAccess, isSuperAdmin } from '@/lib/crm/access'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'
import { prisma } from '@/lib/prisma'

/** Full-access CRM actor for MCP connector tool calls (admin-consented OAuth). */
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

  const crmRoles = await fetchUserCrmRoles(user.id)
  const subject = { id: user.id, email: user.email, crmRoles }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phoneNumber: user.phoneNumber,
    crmRoles,
    fullAccess: isFullAccess(subject),
    superAdmin: isSuperAdmin(subject),
  }
}
