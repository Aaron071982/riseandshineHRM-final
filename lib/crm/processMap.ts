import type { ClientOwnerDept, CrmRole, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  canAccessDepartment,
  type CrmAccessSubject,
  getVisibleClientsWhere,
  isFullAccess,
  ownerDeptsForUser,
  auditClientAction,
} from '@/lib/crm/access'
import { deptHref, OWNER_TO_DEPT_SLUG } from '@/lib/crm/departments'
import { OWNER_DEPT_LABELS, STAGE_DEFAULT_OWNER_DEPT, STAGE_DESCRIPTIONS, STAGE_LABELS } from '@/lib/crm/stages'
import {
  buildHandoffs,
  LEADERSHIP_ROLES,
  PROCESS_DEPT_ACCENT,
  PROCESS_DEPT_ORDER,
  PROCESS_DEPT_TO_ROLE,
  type ProcessCounts,
  type ProcessDepartment,
  type ProcessMapData,
  type ProcessPerson,
  stagesByDept,
} from '@/lib/crm/processMapModel'

export * from '@/lib/crm/processMapModel'

async function loadPeopleByRole(): Promise<Map<CrmRole, ProcessPerson[]>> {
  const rows = await prisma.userCrmRole.findMany({
    where: { revokedAt: null },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ user: { name: 'asc' } }, { user: { email: 'asc' } }],
  })

  const rolesByUser = new Map<string, CrmRole[]>()
  for (const row of rows) {
    const list = rolesByUser.get(row.user.id) ?? []
    if (!list.includes(row.role)) list.push(row.role)
    rolesByUser.set(row.user.id, list)
  }

  const byRole = new Map<CrmRole, ProcessPerson[]>()
  for (const row of rows) {
    const person: ProcessPerson = {
      id: row.user.id,
      label: row.user.name ?? row.user.email ?? 'Unnamed user',
      roles: rolesByUser.get(row.user.id) ?? [row.role],
    }
    const list = byRole.get(row.role) ?? []
    if (!list.some((p) => p.id === person.id)) list.push(person)
    byRole.set(row.role, list)
  }
  return byRole
}

async function loadCounts(
  scope: Prisma.ServiceClientWhereInput
): Promise<Record<ClientOwnerDept, ProcessCounts>> {
  const live: Prisma.ServiceClientWhereInput = {
    AND: [scope, { pipelineStatus: 'LIVE' }],
  }

  const [totals, unclaimed] = await Promise.all([
    prisma.serviceClient.groupBy({
      by: ['currentOwnerDept'],
      where: live,
      _count: { _all: true },
    }),
    prisma.serviceClient.groupBy({
      by: ['currentOwnerDept'],
      where: { AND: [live, { currentOwnerUserId: null }] },
      _count: { _all: true },
    }),
  ])

  const counts = Object.fromEntries(
    PROCESS_DEPT_ORDER.map((d) => [d, { total: 0, unclaimed: 0, claimed: 0 }])
  ) as Record<ClientOwnerDept, ProcessCounts>

  for (const row of totals) {
    const dept = row.currentOwnerDept
    if (!dept || !counts[dept]) continue
    counts[dept].total = row._count._all
  }
  for (const row of unclaimed) {
    const dept = row.currentOwnerDept
    if (!dept || !counts[dept]) continue
    counts[dept].unclaimed = row._count._all
  }
  for (const dept of PROCESS_DEPT_ORDER) {
    const c = counts[dept]!
    c.claimed = Math.max(0, c.total - c.unclaimed)
  }
  return counts
}

/**
 * Live process/ownership chart data. Structure comes from CRM stage config, so
 * it renders fully even with zero CRM roles granted; people come from
 * `user_crm_roles` and counts respect the viewer's client scope.
 */
export async function loadProcessMap(
  user: CrmAccessSubject
): Promise<ProcessMapData> {
  const [peopleByRole, counts] = await Promise.all([
    loadPeopleByRole(),
    loadCounts(getVisibleClientsWhere(user)),
  ])

  const stages = stagesByDept()
  const full = isFullAccess(user)
  const viewerDepts = ownerDeptsForUser(user)

  const departments: ProcessDepartment[] = PROCESS_DEPT_ORDER.map((dept) => {
    const slug = OWNER_TO_DEPT_SLUG[dept]
    return {
      dept,
      label: OWNER_DEPT_LABELS[dept],
      slug,
      href: deptHref(slug),
      accent: PROCESS_DEPT_ACCENT[dept],
      stages: stages[dept] ?? [],
      people: peopleByRole.get(PROCESS_DEPT_TO_ROLE[dept]) ?? [],
      counts: counts[dept] ?? { total: 0, unclaimed: 0, claimed: 0 },
      canOpen: canAccessDepartment(user, dept),
      scopeLimited: !full && !viewerDepts.includes(dept),
    }
  })

  const leadershipById = new Map<string, ProcessPerson>()
  for (const role of LEADERSHIP_ROLES) {
    for (const person of peopleByRole.get(role) ?? []) {
      leadershipById.set(person.id, person)
    }
  }

  const result: ProcessMapData = {
    departments,
    leadership: [...leadershipById.values()].sort((a, b) =>
      a.label.localeCompare(b.label)
    ),
    handoffs: buildHandoffs(),
    parallelTrack: {
      stage: 'TREATMENT_PLAN',
      label: STAGE_LABELS.TREATMENT_PLAN,
      description: STAGE_DESCRIPTIONS.TREATMENT_PLAN,
      ownerDept: STAGE_DEFAULT_OWNER_DEPT.TREATMENT_PLAN,
    },
    viewerFullAccess: full,
  }

  if (user.id) {
    await auditClientAction({
      userId: user.id,
      action: 'PROCESS_MAP_VIEW',
    })
  }

  return result
}
