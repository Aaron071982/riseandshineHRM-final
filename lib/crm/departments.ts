import type { ClientOwnerDept, ClientStage, CrmRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getVisibleClientsWhere,
  isFullAccess,
  auditClientAction,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { daysInStage, isStalled } from '@/lib/crm/thresholds'
import { OWNER_DEPT_LABELS } from '@/lib/crm/stages'

export type DeptSlug =
  | 'intake'
  | 'clinical'
  | 'authorization'
  | 'staffing'
  | 'case-coordination'
  | 'billing'

export const DEPT_SLUGS: readonly DeptSlug[] = [
  'intake',
  'clinical',
  'authorization',
  'staffing',
  'case-coordination',
  'billing',
] as const

export const DEPT_SLUG_TO_OWNER: Record<DeptSlug, ClientOwnerDept> = {
  intake: 'INTAKE',
  clinical: 'CLINICAL',
  authorization: 'AUTHORIZATION',
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
  authorization: 'AUTHORIZATION',
  staffing: 'STAFFING',
  'case-coordination': 'CASE_COORDINATION',
  billing: 'BILLING',
}

export function isDeptSlug(v: string): v is DeptSlug {
  return (DEPT_SLUGS as readonly string[]).includes(v)
}

export function deptHref(slug: DeptSlug): string {
  return `/client-services/dept/${slug}`
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
  nextAction: string | null
  nextActionDueAt: string | null
  daysInStage: number
  stalled: boolean
  rbtTargetDate: string | null
}

export type DepartmentQueueData = {
  dept: ClientOwnerDept
  slug: DeptSlug
  label: string
  unclaimed: DepartmentQueueRow[]
  claimed: DepartmentQueueRow[]
  /** Case Coordination only — personal worklist. */
  myCaseload: DepartmentQueueRow[] | null
  canManage: boolean
  viewerUserId: string
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
  }
): DepartmentQueueRow {
  const aging = {
    stage: c.stage,
    stageEnteredAt: c.stageEnteredAt,
    rbtTargetDate: c.rbtTargetDate,
  }
  return {
    id: c.id,
    clientCode: c.clientCode,
    firstName: c.firstName,
    lastName: c.lastName,
    stage: c.stage,
    currentOwnerDept: c.currentOwnerDept,
    currentOwnerUserId: c.currentOwnerUserId,
    caseCoordinatorUserId: c.caseCoordinatorUserId,
    ownerName:
      c.currentOwnerUser?.name ?? c.currentOwnerUser?.email ?? null,
    nextAction: c.nextAction,
    nextActionDueAt: c.nextActionDueAt?.toISOString() ?? null,
    daysInStage: daysInStage(aging),
    stalled: isStalled(aging),
    rbtTargetDate: c.rbtTargetDate?.toISOString().slice(0, 10) ?? null,
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

/**
 * A department keeps ownership of its normal queue while selected downstream
 * teams get an early, read-only view of work they can begin in parallel.
 */
export function getDepartmentQueueMembershipWhere(
  dept: ClientOwnerDept
): Prisma.ServiceClientWhereInput {
  if (dept === 'STAFFING') {
    return {
      pipelineStatus: 'LIVE',
      OR: [
        { currentOwnerDept: 'STAFFING' },
        { currentOwnerDept: 'AUTHORIZATION', stage: 'APPROVED' },
      ],
    }
  }

  if (dept === 'CASE_COORDINATION') {
    return {
      pipelineStatus: 'LIVE',
      OR: [
        { currentOwnerDept: 'CASE_COORDINATION' },
        { currentOwnerDept: 'STAFFING', stage: 'RBT_SEARCH' },
      ],
    }
  }

  return { currentOwnerDept: dept, pipelineStatus: 'LIVE' }
}

export async function loadDepartmentQueue(
  user: CrmAccessSubject & { id: string },
  slug: DeptSlug
): Promise<DepartmentQueueData> {
  const dept = DEPT_SLUG_TO_OWNER[slug]
  const scope = getVisibleClientsWhere(user)

  const deptWhere: Prisma.ServiceClientWhereInput = {
    AND: [scope, getDepartmentQueueMembershipWhere(dept)],
  }

  const rows = await loadRows(deptWhere)
  const unclaimed = rows.filter((r) => !r.currentOwnerUserId)
  const claimed = rows.filter((r) => !!r.currentOwnerUserId)

  let myCaseload: DepartmentQueueRow[] | null = null
  if (slug === 'case-coordination') {
    myCaseload = await loadRows({
      AND: [
        scope,
        {
          OR: [
            { caseCoordinatorUserId: user.id },
            { currentOwnerUserId: user.id },
          ],
        },
      ],
    })
  }

  await auditClientAction({
    userId: user.id,
    action: `DEPT_QUEUE_VIEW:${dept}`,
  })

  return {
    dept,
    slug,
    label: deptLabel(slug),
    unclaimed,
    claimed,
    myCaseload,
    canManage: isFullAccess(user),
    viewerUserId: user.id,
  }
}
