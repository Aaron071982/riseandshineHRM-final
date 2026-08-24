import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CrmAccessError } from '@/lib/crm/access'

export type CrmTaskAssigneeUser = {
  id: string
  name: string | null
  email: string | null
}

export const crmTaskAssigneeUserSelect = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.UserSelect

/** Active HRM admins with at least one CRM role (excludes RBTs and other roles). */
export function crmTaskAssigneeUserWhere(): Prisma.UserWhereInput {
  return {
    isActive: true,
    email: { not: null },
    role: 'ADMIN',
    crmRoles: { some: { revokedAt: null } },
  }
}

export async function loadCrmTaskAssigneeUsers(): Promise<CrmTaskAssigneeUser[]> {
  return prisma.user.findMany({
    where: crmTaskAssigneeUserWhere(),
    select: crmTaskAssigneeUserSelect,
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    take: 200,
  })
}

export async function assertCrmTaskAssigneeUserId(userId: string): Promise<void> {
  const row = await prisma.user.findFirst({
    where: {
      AND: [{ id: userId }, crmTaskAssigneeUserWhere()],
    },
    select: { id: true },
  })
  if (!row) {
    throw new CrmAccessError('Tasks can only be assigned to CRM admins', 400)
  }
}
