import type { ClientOwnerDept, ClientStage, CrmRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getVisibleClientsWhere,
  isFullAccess,
  isSuperAdmin,
  auditClientAction,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import {
  DEPT_SLUGS,
  deptHref,
  isDeptSlug,
  type DeptSlug,
} from '@/lib/crm/deptPaths'
import { daysInStage, isStalled } from '@/lib/crm/thresholds'
import { OWNER_DEPT_LABELS, canonicalOwnerDeptForStage } from '@/lib/crm/stages'
import {
  CLAIMABLE_POOL_SELECT,
  isReadyForCoordination,
  noActiveDeptClaimWhere,
  toClaimablePoolRow,
  type ClaimablePoolRow,
} from '@/lib/crm/claims'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { deriveMetricsForClients } from '@/lib/client-services/serviceStatus'
import {
  hoursUtilizationPct,
  isReceivingUnderAuthorizedThreshold,
  STAFFING_HOURS_UTILIZATION_THRESHOLD,
} from '@/lib/crm/staffingUnderHours'

export type { DeptSlug }
export { DEPT_SLUGS, deptHref, isDeptSlug }

export const DEPT_SLUG_TO_OWNER: Record<DeptSlug, ClientOwnerDept> = {
  intake: 'INTAKE',
  clinical: 'CLINICAL',
  authorization: 'BILLING',
  staffing: 'STAFFING',
  'case-coordination': 'CASE_COORDINATION',
  billing: 'BILLING',
}

export const OWNER_TO_DEPT_SLUG: Record<ClientOwnerDept, DeptSlug> = {
  INTAKE: 'intake',
  CLINICAL: 'clinical',
  AUTHORIZATION: 'authorization',
  STAFFING: 'staffing',
  CASE_COORDINATION: 'case-coordination',
  BILLING: 'billing',
}

export const DEPT_SLUG_TO_CRM_ROLE: Record<DeptSlug, CrmRole> = {
  intake: 'INTAKE',
  clinical: 'CLINICAL',
  authorization: 'BILLING',
  staffing: 'STAFFING',
  'case-coordination': 'CASE_COORDINATION',
  billing: 'BILLING',
}

export function deptLabel(slug: DeptSlug): string {
  return OWNER_DEPT_LABELS[DEPT_SLUG_TO_OWNER[slug]]
}

export type DepartmentQueueRow = {
  id: string
  clientCode: string
  firstName: string
  lastName: string
  stage: ClientStage
  currentOwnerDept: ClientOwnerDept | null
  currentOwnerUserId: string | null
  caseCoordinatorUserId: string | null
  ownerName: string | null
  coordinatorName: string | null
  nextAction: string | null
  nextActionDueAt: string | null
  daysInStage: number
  stalled: boolean
  rbtTargetDate: string | null
  billingSubstep: string | null
  scheduledHoursPerWeek?: number | null
  authHours?: number | null
  hoursUtilizationPct?: number | null
  staffingNeedsMoreHours?: boolean
  staffingHighPriority?: boolean
}

export type CoordinatorGroup = {
  userId: string
  name: string
  upcoming: DepartmentQueueRow[]
  ready: DepartmentQueueRow[]
}

export type DepartmentQueueData = {
  dept: ClientOwnerDept
  slug: DeptSlug
  label: string
  /** Name + current stage only. No other PHI. */
  unclaimed: ClaimablePoolRow[]
  /** Full queue rows for managers — open profiles without claiming. */
  unclaimedFull: DepartmentQueueRow[] | null
  claimed: DepartmentQueueRow[]
  upcoming: DepartmentQueueRow[] | null
  ready: DepartmentQueueRow[] | null
  unassignedCc: ClaimablePoolRow[] | null
  coordinatorGroups: CoordinatorGroup[] | null
  caseCoordinators: { id: string; name: string | null; email: string | null }[] | null
  canManage: boolean
  canAssignCc: boolean
  viewerUserId: string
  /** ACTIVE clients scheduled below authorized-hours threshold (staffing only). */
  underHoursActive: DepartmentQueueRow[] | null
  /** ACTIVE clients manually flagged as needing more therapist hours (staffing only). */
  needsMoreHoursActive: DepartmentQueueRow[] | null
}

function mapRow(
  c: {
    id: string
    clientCode: string
    firstName: string
    lastName: string
    stage: ClientStage
    stageEnteredAt: Date | null
    currentOwnerDept: ClientOwnerDept | null
    currentOwnerUserId: string | null
    caseCoordinatorUserId: string | null
    nextAction: string | null
    nextActionDueAt: Date | null
    rbtTargetDate: Date | null
    currentOwnerUser: { name: string | null; email: string | null } | null
    caseCoordinatorUser: { name: string | null; email: string | null } | null
    authorizations: {
      authType: 'ASSESSMENT' | 'TREATMENT'
      status: 'REQUESTED' | 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'
    }[]
  }
): DepartmentQueueRow {
  const aging = {
    stage: c.stage,
    stageEnteredAt: c.stageEnteredAt,
    rbtTargetDate: c.rbtTargetDate,
  }
  const hasVob = Boolean(
    c.authorizations.find((a) => a.authType === 'ASSESSMENT' && a.status === 'APPROVED')
  )
  const treatment = c.authorizations.find((a) => a.authType === 'TREATMENT')
  let billingSubstep: string | null = null
  if (c.currentOwnerDept === 'BILLING') {
    if (!hasVob || c.stage === 'BENEFITS') billingSubstep = 'Needs VOB'
    else if (!treatment && c.stage === 'AUTHORIZATION') billingSubstep = 'VOB done / needs PA'
    else if (treatment?.status === 'REQUESTED' || treatment?.status === 'PENDING')
      billingSubstep = 'PA submitted / waiting'
    else if (treatment?.status === 'APPROVED') billingSubstep = 'PA approved'
    else if (treatment?.status === 'DENIED' || treatment?.status === 'EXPIRED')
      billingSubstep = 'Denied/problem'
  }

  return {
    id: c.id,
    clientCode: c.clientCode,
    firstName: c.firstName,
    lastName: c.lastName,
    stage: c.stage,
    currentOwnerDept: canonicalOwnerDeptForStage(c.stage, c.currentOwnerDept),
    currentOwnerUserId: c.currentOwnerUserId,
    caseCoordinatorUserId: c.caseCoordinatorUserId,
    ownerName:
      c.currentOwnerUser?.name ?? c.currentOwnerUser?.email ?? null,
    coordinatorName:
      c.caseCoordinatorUser?.name ?? c.caseCoordinatorUser?.email ?? null,
    nextAction: c.nextAction,
    nextActionDueAt: c.nextActionDueAt?.toISOString() ?? null,
    daysInStage: daysInStage(aging),
    stalled: isStalled(aging),
    rbtTargetDate: c.rbtTargetDate?.toISOString().slice(0, 10) ?? null,
    billingSubstep,
  }
}

const queueSelect = {
  id: true,
  clientCode: true,
  firstName: true,
  lastName: true,
  stage: true,
  stageEnteredAt: true,
  currentOwnerDept: true,
  currentOwnerUserId: true,
  caseCoordinatorUserId: true,
  nextAction: true,
  nextActionDueAt: true,
  rbtTargetDate: true,
  currentOwnerUser: { select: { name: true, email: true } },
  caseCoordinatorUser: { select: { name: true, email: true } },
  authorizations: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { authType: true, status: true },
    take: 6,
  },
} as const

async function loadRows(
  where: Prisma.ServiceClientWhereInput
): Promise<DepartmentQueueRow[]> {
  const clients = await prisma.serviceClient.findMany({
    where,
    select: queueSelect,
    orderBy: [{ nextActionDueAt: 'asc' }, { stageEnteredAt: 'asc' }],
    take: 500,
  })
  return clients.map(mapRow)
}

async function loadClaimablePool(
  where: Prisma.ServiceClientWhereInput
): Promise<ClaimablePoolRow[]> {
  const rows = await prisma.serviceClient.findMany({
    where,
    select: CLAIMABLE_POOL_SELECT,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 500,
  })
  return rows.map(toClaimablePoolRow)
}

/**
 * Department work-surface membership: currently owned by this department.
 * Phase-8 cross-listing (staffing seeing APPROVED, CC seeing RBT_SEARCH) is gone.
 */
export function getDepartmentQueueMembershipWhere(
  dept: ClientOwnerDept
): Prisma.ServiceClientWhereInput {
  return { currentOwnerDept: dept, pipelineStatus: 'LIVE' }
}

function canAssignCc(user: CrmAccessSubject): boolean {
  return isFullAccess(user) || isSuperAdmin(user)
}

async function loadCaseCoordinatorsList(): Promise<
  NonNullable<DepartmentQueueData['caseCoordinators']>
> {
  return prisma.user.findMany({
    where: {
      isActive: true,
      crmRoles: { some: { revokedAt: null, role: 'CASE_COORDINATION' } },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    take: 100,
  })
}

export async function loadDepartmentQueue(
  user: CrmAccessSubject & { id: string },
  slug: DeptSlug
): Promise<DepartmentQueueData> {
  const dept = DEPT_SLUG_TO_OWNER[slug]
  const manage = isFullAccess(user) || isSuperAdmin(user)
  const assignCc = canAssignCc(user)

  const empty: DepartmentQueueData = {
    dept,
    slug,
    label: deptLabel(slug),
    unclaimed: [],
    unclaimedFull: null,
    claimed: [],
    upcoming: null,
    ready: null,
    unassignedCc: null,
    coordinatorGroups: null,
    caseCoordinators: null,
    canManage: manage,
    canAssignCc: assignCc,
    viewerUserId: user.id,
    underHoursActive: null,
    needsMoreHoursActive: null,
  }

  if (slug === 'case-coordination') {
    return loadCaseCoordinationQueue(user, empty)
  }

  if (slug === 'staffing') {
    return loadStaffingQueue(user, empty)
  }

  const membership = getDepartmentQueueMembershipWhere(dept)
  const unclaimedWhere: Prisma.ServiceClientWhereInput = {
    AND: [{ ...NOT_DELETED }, membership, { currentOwnerUserId: null }, noActiveDeptClaimWhere()],
  }
  const unclaimed = await loadClaimablePool(unclaimedWhere)
  const unclaimedFull = manage ? await loadRows(unclaimedWhere) : null

  let caseCoordinators: DepartmentQueueData['caseCoordinators'] = null
  if (assignCc) {
    caseCoordinators = await loadCaseCoordinatorsList()
  }

  const claimedWhere: Prisma.ServiceClientWhereInput = manage
    ? { AND: [{ ...NOT_DELETED }, membership, { currentOwnerUserId: { not: null } }] }
    : {
        AND: [
          { ...NOT_DELETED },
          membership,
          { claims: { some: { userId: user.id, releasedAt: null } } },
        ],
      }

  const claimed = await loadRows(claimedWhere)

  await auditClientAction({
    userId: user.id,
    action: `DEPT_QUEUE_VIEW:${dept}`,
  })

  return { ...empty, unclaimed, unclaimedFull, claimed, caseCoordinators }
}

async function loadStaffingNeedsMoreHoursActive(
  excludeIds: Set<string>
): Promise<DepartmentQueueRow[]> {
  const clients = await prisma.serviceClient.findMany({
    where: {
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      stage: 'ACTIVE',
      staffingNeedsMoreHours: true,
    },
    select: {
      ...queueSelect,
      staffingNeedsMoreHours: true,
      staffingHighPriority: true,
      authHours: true,
      status: true,
      btAssignments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { btName: true },
      },
    },
    orderBy: [
      { staffingHighPriority: 'desc' },
      { nextActionDueAt: 'asc' },
      { stageEnteredAt: 'asc' },
    ],
    take: 500,
  })

  if (clients.length === 0) return []

  const metrics = await deriveMetricsForClients(
    clients.map((c) => ({
      id: c.id,
      status: c.status,
      authHours: c.authHours,
      btAssignments: c.btAssignments,
    }))
  )

  return clients
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => {
      const m = metrics.get(c.id)
      const pct =
        m && c.authHours
          ? hoursUtilizationPct(m.scheduledHoursPerWeek, c.authHours)
          : null
      return {
        ...mapRow(c),
        scheduledHoursPerWeek: m?.scheduledHoursPerWeek ?? null,
        authHours: c.authHours,
        hoursUtilizationPct: pct,
        staffingNeedsMoreHours: c.staffingNeedsMoreHours,
        staffingHighPriority: c.staffingHighPriority,
      }
    })
}

async function loadStaffingUnderHoursActive(
  excludeIds: Set<string>
): Promise<DepartmentQueueRow[]> {
  const candidates = await prisma.serviceClient.findMany({
    where: {
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      stage: 'ACTIVE',
      authHours: { gt: 0 },
    },
    select: {
      ...queueSelect,
      status: true,
      authHours: true,
      btAssignments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { btName: true },
      },
    },
    orderBy: [{ nextActionDueAt: 'asc' }, { stageEnteredAt: 'asc' }],
    take: 500,
  })

  if (candidates.length === 0) return []

  const metrics = await deriveMetricsForClients(
    candidates.map((c) => ({
      id: c.id,
      status: c.status,
      authHours: c.authHours,
      btAssignments: c.btAssignments,
    }))
  )

  return candidates
    .filter((c) => {
      if (excludeIds.has(c.id)) return false
      const m = metrics.get(c.id)
      if (!m) return false
      return isReceivingUnderAuthorizedThreshold(
        m.scheduledHoursPerWeek,
        c.authHours
      )
    })
    .map((c) => {
      const m = metrics.get(c.id)!
      const pct = hoursUtilizationPct(m.scheduledHoursPerWeek, c.authHours)
      return {
        ...mapRow(c),
        scheduledHoursPerWeek: m.scheduledHoursPerWeek,
        authHours: c.authHours,
        hoursUtilizationPct: pct,
      }
    })
}

async function loadStaffingQueue(
  user: CrmAccessSubject & { id: string },
  empty: DepartmentQueueData
): Promise<DepartmentQueueData> {
  const dept = empty.dept
  const manage = empty.canManage
  const assignCc = empty.canAssignCc

  const membership = getDepartmentQueueMembershipWhere(dept)
  const unclaimedWhere: Prisma.ServiceClientWhereInput = {
    AND: [{ ...NOT_DELETED }, membership, { currentOwnerUserId: null }, noActiveDeptClaimWhere()],
  }
  const unclaimed = await loadClaimablePool(unclaimedWhere)
  const unclaimedFull = manage ? await loadRows(unclaimedWhere) : null

  let caseCoordinators: DepartmentQueueData['caseCoordinators'] = null
  if (assignCc) {
    caseCoordinators = await loadCaseCoordinatorsList()
  }

  const claimedWhere: Prisma.ServiceClientWhereInput = manage
    ? { AND: [{ ...NOT_DELETED }, membership, { currentOwnerUserId: { not: null } }] }
    : {
        AND: [
          { ...NOT_DELETED },
          membership,
          { claims: { some: { userId: user.id, releasedAt: null } } },
        ],
      }

  const claimed = await loadRows(claimedWhere)

  const excludeIds = new Set<string>([
    ...unclaimed.map((r) => r.id),
    ...claimed.map((r) => r.id),
  ])
  const needsMoreHoursActive = await loadStaffingNeedsMoreHoursActive(excludeIds)
  for (const row of needsMoreHoursActive) {
    excludeIds.add(row.id)
  }
  const underHoursActive = await loadStaffingUnderHoursActive(excludeIds)

  await auditClientAction({
    userId: user.id,
    action: `DEPT_QUEUE_VIEW:${dept}`,
  })

  return {
    ...empty,
    unclaimed,
    unclaimedFull,
    claimed,
    caseCoordinators,
    needsMoreHoursActive,
    underHoursActive,
  }
}

async function loadCaseCoordinationQueue(
  user: CrmAccessSubject & { id: string },
  base: DepartmentQueueData
): Promise<DepartmentQueueData> {
  const assignedWhere: Prisma.ServiceClientWhereInput = canAssignCc(user)
    ? { AND: [{ ...NOT_DELETED }, { pipelineStatus: 'LIVE' }, { caseCoordinatorUserId: { not: null } }] }
    : {
        AND: [
          { ...NOT_DELETED },
          { pipelineStatus: 'LIVE' },
          { caseCoordinatorUserId: user.id },
        ],
      }

  const assigned = await loadRows(assignedWhere)
  const upcoming = assigned.filter((r) => !isReadyForCoordination(r.stage))
  const ready = assigned.filter((r) => isReadyForCoordination(r.stage))

  let coordinatorGroups: CoordinatorGroup[] | null = null
  let unassignedCc: ClaimablePoolRow[] | null = null
  let caseCoordinators: DepartmentQueueData['caseCoordinators'] = null

  if (canAssignCc(user)) {
    const byCc = new Map<string, CoordinatorGroup>()
    for (const row of assigned) {
      const id = row.caseCoordinatorUserId ?? 'unknown'
      const name = row.coordinatorName ?? 'Unnamed coordinator'
      const group = byCc.get(id) ?? { userId: id, name, upcoming: [], ready: [] }
      if (isReadyForCoordination(row.stage)) group.ready.push(row)
      else group.upcoming.push(row)
      byCc.set(id, group)
    }
    coordinatorGroups = [...byCc.values()].sort((a, b) => a.name.localeCompare(b.name))

    unassignedCc = await loadClaimablePool({
      AND: [
        { ...NOT_DELETED },
        { pipelineStatus: 'LIVE' },
        { caseCoordinatorUserId: null },
        {
          OR: [
            { currentOwnerDept: 'CASE_COORDINATION' },
            { stage: { in: ['RBT_ASSIGNED', 'SCHEDULE_COORDINATION', 'SCHEDULE_CONFIRMED', 'PRE_START', 'ACTIVE'] } },
          ],
        },
      ],
    })

    caseCoordinators = await loadCaseCoordinatorsList()
  }

  await auditClientAction({
    userId: user.id,
    action: 'DEPT_QUEUE_VIEW:CASE_COORDINATION',
  })

  return {
    ...base,
    upcoming,
    ready,
    unassignedCc,
    coordinatorGroups,
    caseCoordinators,
    underHoursActive: null,
    needsMoreHoursActive: null,
  }
}

/** Kept for callers that still compose with getVisibleClientsWhere. */
export { getVisibleClientsWhere }
