'use server'

import type { CrmRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import {
  assertCrmSuperAdmin,
  CrmAccessError,
  fetchUserCrmRoles,
  getClientServicesUser,
  isFullAccess,
  isSuperAdmin,
  CRM_DEPARTMENT_ROLES,
  ownerDeptsForUser,
  rethrowIfNextControlFlow,
} from '@/lib/crm/access'

export type RoleActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status?: number }

const ALL_CRM_ROLES: CrmRole[] = [
  'SUPER_ADMIN',
  'MANAGEMENT',
  'INTAKE',
  'CLINICAL',
  'AUTHORIZATION',
  'STAFFING',
  'CASE_COORDINATION',
  'BILLING',
]

function fail(err: unknown): RoleActionResult {
  rethrowIfNextControlFlow(err)
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[crm-roles] action failed', err)
  return { ok: false, error: 'Something went wrong' }
}

export async function listCrmUsersWithRoles(query?: string): Promise<
  RoleActionResult<{
    users: {
      id: string
      name: string | null
      email: string | null
      roles: CrmRole[]
      fullAccess: boolean
      superAdmin: boolean
      departments: CrmRole[]
      ownerDepts: string[]
    }[]
  }>
> {
  try {
    const actor = await getClientServicesUser()
    await assertCrmSuperAdmin(actor)

    const q = query?.trim()
    const users = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        crmRoles: {
          where: { revokedAt: null },
          select: { role: true },
        },
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 100,
    })

    return {
      ok: true,
      users: users.map((u) => {
        const roles = u.crmRoles.map((r) => r.role)
        const subject = { id: u.id, email: u.email, crmRoles: roles }
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          roles,
          fullAccess: isFullAccess(subject),
          superAdmin: isSuperAdmin(subject),
          departments: roles.filter((r) =>
            (CRM_DEPARTMENT_ROLES as readonly string[]).includes(r)
          ),
          ownerDepts: ownerDeptsForUser(subject),
        }
      }),
    }
  } catch (err) {
    return fail(err) as RoleActionResult<{ users: never[] }>
  }
}

export async function grantCrmRole(
  targetUserId: string,
  role: CrmRole
): Promise<RoleActionResult> {
  try {
    const actor = await getClientServicesUser()
    await assertCrmSuperAdmin(actor)

    if (!ALL_CRM_ROLES.includes(role)) {
      return { ok: false, error: 'Invalid role' }
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true, role: true },
    })
    if (!target) {
      return {
        ok: false,
        error: 'User must exist first — ask them to log in, then grant the role',
      }
    }
    if (target.role !== 'ADMIN') {
      return {
        ok: false,
        error: 'CRM roles can only be granted to HRM admin users',
      }
    }

    const existing = await prisma.userCrmRole.findUnique({
      where: { userId_role: { userId: targetUserId, role } },
    })

    if (existing && !existing.revokedAt) {
      return { ok: true }
    }

    if (existing?.revokedAt) {
      await prisma.userCrmRole.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          revokedByUserId: null,
          grantedAt: new Date(),
          grantedByUserId: actor.id,
        },
      })
    } else {
      await prisma.userCrmRole.create({
        data: {
          userId: targetUserId,
          role,
          grantedByUserId: actor.id,
        },
      })
    }

    await writeAuditLog({
      actorUserId: actor.id,
      entityType: 'UserCrmRole',
      entityId: targetUserId,
      action: 'CREATE',
      after: {
        role,
        targetUserId,
        targetEmail: target.email,
        action: 'GRANT',
      },
    })

    revalidatePath('/client-services/admin')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function revokeCrmRole(
  targetUserId: string,
  role: CrmRole
): Promise<RoleActionResult<{ warned?: string }>> {
  try {
    const actor = await getClientServicesUser()
    await assertCrmSuperAdmin(actor)

    const existing = await prisma.userCrmRole.findUnique({
      where: { userId_role: { userId: targetUserId, role } },
    })
    if (!existing || existing.revokedAt) {
      return { ok: false, error: 'Role is not active on this user' }
    }

    if (role === 'SUPER_ADMIN') {
      const activeSuperCount = await prisma.userCrmRole.count({
        where: { role: 'SUPER_ADMIN', revokedAt: null },
      })
      if (activeSuperCount <= 1) {
        return {
          ok: false,
          error: 'Cannot remove the last SUPER_ADMIN — grant another first',
        }
      }
    }

    let warned: string | undefined
    if (role === 'SUPER_ADMIN' && targetUserId === actor.id) {
      const myRoles = await fetchUserCrmRoles(actor.id)
      const otherSupers = myRoles.filter((r) => r === 'SUPER_ADMIN').length
      if (otherSupers >= 1) {
        warned =
          'You are revoking your own SUPER_ADMIN role. You may lose Admin Management access.'
      }
    }

    await prisma.userCrmRole.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        revokedByUserId: actor.id,
      },
    })

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true },
    })

    await writeAuditLog({
      actorUserId: actor.id,
      entityType: 'UserCrmRole',
      entityId: targetUserId,
      action: 'UPDATE',
      before: { role, active: true },
      after: {
        role,
        action: 'REVOKE',
        targetEmail: target?.email,
        revokedAt: new Date().toISOString(),
      },
    })

    revalidatePath('/client-services/admin')
    return { ok: true, ...(warned ? { warned } : {}) }
  } catch (err) {
    return fail(err) as RoleActionResult<{ warned?: string }>
  }
}
