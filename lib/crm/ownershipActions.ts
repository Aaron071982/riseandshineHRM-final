'use server'

import type { ClientOwnerDept } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import {
  assertCanEditClient,
  auditClientAction,
  canActAsOwningDepartment,
  CrmAccessError,
  fetchUserCrmRoles,
  getClientServicesUser,
  isFullAccess,
  isSuperAdmin,
  OWNER_DEPT_TO_CRM_ROLE,
  rethrowIfNextControlFlow,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { OWNER_DEPT_LABELS } from '@/lib/crm/stages'
import { grantClaim, releaseActiveGrants } from '@/lib/crm/claims'

export type OwnershipActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status?: number }

function fail<T extends object = object>(err: unknown): OwnershipActionResult<T> {
  rethrowIfNextControlFlow(err)
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[crm-ownership] action failed', err)
  return { ok: false, error: 'Something went wrong' }
}

function revalidateOwnership(clientId: string) {
  revalidatePath(`/client-services/clients/${clientId}`)
  revalidatePath('/client-services')
  revalidatePath('/client-services/dept', 'layout')
}

const ALL_OWNER_DEPTS: ClientOwnerDept[] = [
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
]

function isOwnerDept(v: string): v is ClientOwnerDept {
  return (ALL_OWNER_DEPTS as string[]).includes(v)
}

async function auditOwnership(params: {
  actorUserId: string
  clientId: string
  action: string
  before: unknown
  after: unknown
}) {
  await auditClientAction({
    userId: params.actorUserId,
    serviceClientId: params.clientId,
    action: params.action,
  })
  await writeAuditLog({
    actorUserId: params.actorUserId,
    entityType: 'ServiceClientOwnership',
    entityId: params.clientId,
    action: 'UPDATE',
    before: params.before,
    after: params.after,
  })
}

function canAssignCaseCoordinator(user: CrmAccessSubject) {
  return isFullAccess(user) || isSuperAdmin(user)
}

/** Claim a case from the name+stage pool. Does not require prior profile access. */
export async function claimClient(
  clientId: string
): Promise<OwnershipActionResult> {
  try {
    const user = await getClientServicesUser()

    const client = await prisma.serviceClient.findFirst({
      where: { id: clientId, deletedAt: null },
      select: {
        id: true,
        currentOwnerDept: true,
        currentOwnerUserId: true,
        caseCoordinatorUserId: true,
      },
    })
    if (!client) throw new CrmAccessError('Forbidden', 403)

    if (client.currentOwnerDept === 'CASE_COORDINATION') {
      throw new CrmAccessError(
        'Case coordination is assigned by a manager — coordinators cannot self-claim',
        403
      )
    }

    if (!canActAsOwningDepartment(user, client.currentOwnerDept)) {
      throw new CrmAccessError(
        'You must hold this department’s role to claim the case',
        403
      )
    }

    const taken = await prisma.clientClaim.findFirst({
      where: {
        serviceClientId: clientId,
        releasedAt: null,
        source: 'CLAIM',
      },
      select: { userId: true },
    })
    if (taken && taken.userId !== user.id) {
      throw new CrmAccessError('This case is already claimed', 409)
    }
    if (client.currentOwnerUserId && client.currentOwnerUserId !== user.id) {
      throw new CrmAccessError('This case is already claimed', 409)
    }

    const before = {
      currentOwnerUserId: client.currentOwnerUserId,
      caseCoordinatorUserId: client.caseCoordinatorUserId,
    }

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: { currentOwnerUserId: user.id },
    })
    await grantClaim({
      clientId,
      userId: user.id,
      source: 'CLAIM',
      actorUserId: user.id,
    })

    await auditOwnership({
      actorUserId: user.id,
      clientId,
      action: 'CLAIM',
      before,
      after: { currentOwnerUserId: user.id, source: 'CLAIM' },
    })

    revalidateOwnership(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Release personal claim; grant is retained (releasedAt set) for ever-claimed view. */
export async function releaseClient(
  clientId: string
): Promise<OwnershipActionResult> {
  try {
    const user = await getClientServicesUser()

    const client = await prisma.serviceClient.findFirst({
      where: { id: clientId, deletedAt: null },
      select: {
        id: true,
        currentOwnerDept: true,
        currentOwnerUserId: true,
        caseCoordinatorUserId: true,
      },
    })
    if (!client) throw new CrmAccessError('Forbidden', 403)

    const isClaimer = client.currentOwnerUserId === user.id
    const isManager = isFullAccess(user)
    if (!isClaimer && !isManager) {
      throw new CrmAccessError(
        'Only the claimer or a manager can release this case',
        403
      )
    }

    const before = {
      currentOwnerUserId: client.currentOwnerUserId,
      caseCoordinatorUserId: client.caseCoordinatorUserId,
    }

    await releaseActiveGrants({
      clientId,
      userId: client.currentOwnerUserId ?? user.id,
      source: 'CLAIM',
      actorUserId: user.id,
    })

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: { currentOwnerUserId: null },
    })

    await auditOwnership({
      actorUserId: user.id,
      clientId,
      action: 'RELEASE',
      before,
      after: { currentOwnerUserId: null },
    })

    revalidateOwnership(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Assign a case to a specific user (manager or same-dept member). */
export async function assignClient(
  clientId: string,
  toUserId: string
): Promise<OwnershipActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      select: {
        id: true,
        currentOwnerDept: true,
        currentOwnerUserId: true,
        caseCoordinatorUserId: true,
      },
    })

    if (!canActAsOwningDepartment(user, client.currentOwnerDept)) {
      throw new CrmAccessError(
        'You must hold this department’s role to assign the case',
        403
      )
    }

    if (client.currentOwnerDept === 'CASE_COORDINATION') {
      return assignCaseCoordinator(clientId, toUserId)
    }

    const assignee = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, email: true, isActive: true },
    })
    if (!assignee || !assignee.isActive) {
      return { ok: false, error: 'Assignee user not found or inactive' }
    }

    if (client.currentOwnerDept) {
      const needed = OWNER_DEPT_TO_CRM_ROLE[client.currentOwnerDept]
      const assigneeRoles = await fetchUserCrmRoles(toUserId)
      const assigneeOk =
        assigneeRoles.includes(needed) ||
        assigneeRoles.includes('SUPER_ADMIN') ||
        assigneeRoles.includes('MANAGEMENT')
      if (!assigneeOk) {
        return {
          ok: false,
          error: `Assignee must hold the ${OWNER_DEPT_LABELS[client.currentOwnerDept]} role`,
        }
      }
    }

    const before = {
      currentOwnerUserId: client.currentOwnerUserId,
      caseCoordinatorUserId: client.caseCoordinatorUserId,
    }

    if (client.currentOwnerUserId && client.currentOwnerUserId !== toUserId) {
      await releaseActiveGrants({
        clientId,
        userId: client.currentOwnerUserId,
        source: 'CLAIM',
        actorUserId: user.id,
      })
    }

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: { currentOwnerUserId: toUserId },
    })
    await grantClaim({
      clientId,
      userId: toUserId,
      source: 'CLAIM',
      actorUserId: user.id,
    })

    await auditOwnership({
      actorUserId: user.id,
      clientId,
      action: 'ASSIGN',
      before,
      after: {
        currentOwnerUserId: toUserId,
        assigneeEmail: assignee.email,
      },
    })

    revalidateOwnership(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Super-admin / case-manager assigns a CASE_COORDINATION user (not self-claim). */
export async function assignCaseCoordinator(
  clientId: string,
  toUserId: string
): Promise<OwnershipActionResult> {
  try {
    const user = await getClientServicesUser()
    if (!canAssignCaseCoordinator(user)) {
      throw new CrmAccessError(
        'Only a super-admin or case manager can assign a case coordinator',
        403
      )
    }

    const client = await prisma.serviceClient.findFirst({
      where: { id: clientId, deletedAt: null },
      select: {
        id: true,
        currentOwnerDept: true,
        currentOwnerUserId: true,
        caseCoordinatorUserId: true,
      },
    })
    if (!client) throw new CrmAccessError('Forbidden', 403)

    const assigneeRoles = await fetchUserCrmRoles(toUserId)
    if (!assigneeRoles.includes('CASE_COORDINATION')) {
      return { ok: false, error: 'Assignee must hold the Case coordination role' }
    }

    const assignee = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, email: true, name: true, isActive: true },
    })
    if (!assignee?.isActive) {
      return { ok: false, error: 'Assignee user not found or inactive' }
    }

    const before = {
      currentOwnerUserId: client.currentOwnerUserId,
      caseCoordinatorUserId: client.caseCoordinatorUserId,
    }

    if (
      client.caseCoordinatorUserId &&
      client.caseCoordinatorUserId !== toUserId
    ) {
      await releaseActiveGrants({
        clientId,
        userId: client.caseCoordinatorUserId,
        source: 'ASSIGNED',
        actorUserId: user.id,
      })
    }

    const ccOwns = client.currentOwnerDept === 'CASE_COORDINATION'
    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        caseCoordinatorUserId: toUserId,
        ...(ccOwns ? { currentOwnerUserId: toUserId } : {}),
      },
    })
    await grantClaim({
      clientId,
      userId: toUserId,
      source: 'ASSIGNED',
      actorUserId: user.id,
    })

    await auditOwnership({
      actorUserId: user.id,
      clientId,
      action: 'CC_ASSIGN',
      before,
      after: {
        caseCoordinatorUserId: toUserId,
        currentOwnerUserId: ccOwns ? toUserId : client.currentOwnerUserId,
        assigneeEmail: assignee.email,
      },
    })

    revalidateOwnership(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function listCaseCoordinators(): Promise<
  OwnershipActionResult<{
    users: { id: string; name: string | null; email: string | null }[]
  }>
> {
  try {
    const actor = await getClientServicesUser()
    if (!canAssignCaseCoordinator(actor)) {
      throw new CrmAccessError('Forbidden', 403)
    }
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        crmRoles: { some: { revokedAt: null, role: 'CASE_COORDINATION' } },
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 100,
    })
    return { ok: true, users }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Mid-work hand-off: move department ownership without advancing stage.
 * Clears personal claim so the receiving department starts unclaimed.
 */
export async function reassignOwnerDept(
  clientId: string,
  toDept: ClientOwnerDept | string,
  reason: string
): Promise<OwnershipActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    if (!isOwnerDept(String(toDept))) {
      return { ok: false, error: 'Invalid destination department' }
    }
    const dest = toDept as ClientOwnerDept
    const note = reason.trim()
    if (!note) {
      return { ok: false, error: 'A hand-off reason is required' }
    }

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      select: {
        id: true,
        stage: true,
        status: true,
        currentOwnerDept: true,
        currentOwnerUserId: true,
        caseCoordinatorUserId: true,
        stageEnteredAt: true,
      },
    })

    if (!canActAsOwningDepartment(user, client.currentOwnerDept)) {
      throw new CrmAccessError(
        'You must hold the current owning department’s role to hand off',
        403
      )
    }

    if (client.currentOwnerDept === dest) {
      return { ok: true }
    }

    const fromDept = client.currentOwnerDept
    const now = new Date()
    const durationSeconds = client.stageEnteredAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - client.stageEnteredAt.getTime()) / 1000)
        )
      : null

    // Keep ASSIGNED grants (CC stays assigned). Release CLAIM grants so the
    // receiving department sees this client in the unclaimed pool. History retained.
    await releaseActiveGrants({
      clientId,
      source: 'CLAIM',
      actorUserId: user.id,
    })

    const ccKeepsOwner =
      dest === 'CASE_COORDINATION' && client.caseCoordinatorUserId
        ? client.caseCoordinatorUserId
        : null

    await prisma.$transaction(async (tx) => {
      await tx.serviceClientStatusHistory.create({
        data: {
          serviceClientId: clientId,
          fromStage: client.stage,
          toStage: client.stage,
          fromStatus: client.status,
          toStatus: client.status,
          durationSeconds,
          reason: `Owner dept hand-off: ${fromDept ?? 'null'} → ${dest}. ${note}`,
          changedBy: user.id,
        },
      })

      await tx.serviceClient.update({
        where: { id: clientId },
        data: {
          currentOwnerDept: dest,
          currentOwnerUserId: ccKeepsOwner,
        },
      })
    })

    await auditOwnership({
      actorUserId: user.id,
      clientId,
      action: 'OWNER_DEPT_HANDOFF',
      before: {
        currentOwnerDept: fromDept,
        currentOwnerUserId: client.currentOwnerUserId,
      },
      after: {
        currentOwnerDept: dest,
        currentOwnerUserId: ccKeepsOwner,
        reason: note,
      },
    })

    revalidateOwnership(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

async function listDeptAssigneesInner(dept: ClientOwnerDept) {
  const role = OWNER_DEPT_TO_CRM_ROLE[dept]
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: 'ADMIN',
      crmRoles: {
        some: {
          revokedAt: null,
          role: { in: [role, 'MANAGEMENT', 'SUPER_ADMIN'] },
        },
      },
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    take: 100,
  })
  return users
}

/** Users who can be assigned within a department (for Reassign UI). */
export async function listDepartmentAssignees(
  dept: ClientOwnerDept
): Promise<
  OwnershipActionResult<{
    users: { id: string; name: string | null; email: string | null }[]
  }>
> {
  try {
    const actor = await getClientServicesUser()
    if (!canActAsOwningDepartment(actor, dept) && !isFullAccess(actor)) {
      throw new CrmAccessError('Forbidden', 403)
    }

    const users = await listDeptAssigneesInner(dept)
    return { ok: true, users }
  } catch (err) {
    return fail(err)
  }
}
