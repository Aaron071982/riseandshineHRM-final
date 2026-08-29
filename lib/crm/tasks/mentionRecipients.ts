import 'server-only'

import type { ClientOwnerDept, CrmRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { OWNER_DEPT_TO_CRM_ROLE } from '@/lib/crm/roleConstants'
import { crmTaskAssigneeUserWhere } from '@/lib/crm/tasks/assignees'
import { TASK_MENTION_DEPTS } from '@/lib/crm/tasks/mentions'

const DEPT_MENTION_ROLES: Partial<Record<ClientOwnerDept, CrmRole[]>> = {
  CLINICAL: ['CLINICAL', 'CLINICAL_SUPPORT'],
}

export function crmRolesForDeptMention(dept: ClientOwnerDept): CrmRole[] {
  return DEPT_MENTION_ROLES[dept] ?? [OWNER_DEPT_TO_CRM_ROLE[dept]]
}

export async function resolveDeptMentionUserIds(
  dept: ClientOwnerDept
): Promise<string[]> {
  if (!TASK_MENTION_DEPTS.includes(dept)) return []
  const roles = crmRolesForDeptMention(dept)
  const users = await prisma.user.findMany({
    where: {
      AND: [
        crmTaskAssigneeUserWhere(),
        {
          crmRoles: {
            some: { role: { in: roles }, revokedAt: null },
          },
        },
      ],
    },
    select: { id: true },
    take: 100,
  })
  return users.map((u) => u.id)
}
