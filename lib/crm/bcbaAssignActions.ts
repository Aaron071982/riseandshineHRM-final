'use server'

import { revalidatePath } from 'next/cache'
import {
  assertCanViewClient,
  auditClientAction,
  CrmAccessError,
  getClientServicesUser,
  isFullAccess,
  isSuperAdmin,
  rethrowIfNextControlFlow,
} from '@/lib/crm/access'
import { ASSIGNABLE_BCBA_ROLES } from '@/lib/crm/bcbaPortal'
import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status?: number }

function fail(err: unknown): ActionResult {
  rethrowIfNextControlFlow(err)
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[bcba-assign]', err)
  return { ok: false, error: 'Something went wrong' }
}

function assertCanAssignPortalBcba(user: {
  id: string
  email?: string | null
  fullAccess: boolean
  superAdmin: boolean
  crmRoles?: import('@prisma/client').CrmRole[]
}): void {
  if (user.fullAccess || user.superAdmin) return
  if (isFullAccess(user) || isSuperAdmin(user)) return
  throw new CrmAccessError('Admin access required to assign a BCBA', 403)
}

export async function listAssignableBcbaUsers(): Promise<
  ActionResult<{
    users: { id: string; name: string | null; email: string | null }[]
  }>
> {
  try {
    const actor = await getClientServicesUser()
    assertCanAssignPortalBcba(actor)

    const rows = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          {
            crmRoles: {
              some: {
                role: { in: [...ASSIGNABLE_BCBA_ROLES] },
                revokedAt: null,
              },
            },
          },
          { role: 'BCBA' },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 200,
    })

    return { ok: true, users: rows }
  } catch (err) {
    return fail(err) as ActionResult<{
      users: { id: string; name: string | null; email: string | null }[]
    }>
  }
}

/** Admin-only: set portal Assigned BCBA (User) on a client. Audited. */
export async function assignPortalBcba(
  clientId: string,
  assignedBcbaId: string | null
): Promise<ActionResult> {
  try {
    const actor = await getClientServicesUser()
    assertCanAssignPortalBcba(actor)
    await assertCanViewClient(actor, clientId)

    let displayName: string | null = null
    if (assignedBcbaId) {
      const target = await prisma.user.findFirst({
        where: {
          id: assignedBcbaId,
          isActive: true,
          OR: [
            {
              crmRoles: {
                some: {
                  role: { in: [...ASSIGNABLE_BCBA_ROLES] },
                  revokedAt: null,
                },
              },
            },
            { role: 'BCBA' },
          ],
        },
        select: { id: true, name: true, email: true },
      })
      if (!target) {
        return { ok: false, error: 'Select a user with BCBA or Clinical Lead role' }
      }
      displayName = target.name || target.email
    }

    const before = await prisma.serviceClient.findFirst({
      where: { id: clientId, ...NOT_DELETED },
      select: { assignedBcbaId: true },
    })
    if (!before) return { ok: false, error: 'Client not found', status: 404 }

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        assignedBcbaId,
        // Keep denormalized staffing name in sync when empty or previously portal-set.
        ...(displayName ? { bcbaName: displayName } : {}),
      },
    })

    await auditClientAction({
      userId: actor.id,
      serviceClientId: clientId,
      action: `PORTAL_BCBA_ASSIGN:${before.assignedBcbaId ?? 'none'}→${assignedBcbaId ?? 'none'}`,
    })

    revalidatePath(`/client-services/clients/${clientId}`)
    revalidatePath('/client-services')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
