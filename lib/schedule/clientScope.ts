import { prisma } from '@/lib/prisma'
import {
  assertCanEditClient,
  assertCanViewClient,
  CrmAccessError,
  isFullAccess,
  type CrmUser,
} from '@/lib/crm/access'

/** Schedule board may mutate unlinked (synthetic) clients only when full-access. */
export async function assertScheduleClientEdit(
  user: CrmUser,
  serviceClientId: string | null | undefined
): Promise<void> {
  if (!serviceClientId) {
    if (!isFullAccess(user)) throw new CrmAccessError('Forbidden', 403)
    return
  }
  await assertCanEditClient(user, serviceClientId)
}

export async function assertScheduleClientView(
  user: CrmUser,
  serviceClientId: string | null | undefined
): Promise<void> {
  if (!serviceClientId) {
    if (!isFullAccess(user)) throw new CrmAccessError('Forbidden', 403)
    return
  }
  await assertCanViewClient(user, serviceClientId)
}

/** Bulk slot ops: every linked client must be editable; any unlinked row requires full-access. */
export async function assertScheduleClientsEdit(
  user: CrmUser,
  serviceClientIds: (string | null | undefined)[]
): Promise<void> {
  if (serviceClientIds.some((id) => !id) && !isFullAccess(user)) {
    throw new CrmAccessError('Forbidden', 403)
  }
  const unique = [...new Set(serviceClientIds.filter(Boolean) as string[])]
  for (const id of unique) {
    await assertCanEditClient(user, id)
  }
}

export async function assertScheduleAssignmentIdsEdit(
  user: CrmUser,
  assignmentIds: string[]
): Promise<void> {
  if (assignmentIds.length === 0) return
  const rows = await prisma.rbtScheduleAssignment.findMany({
    where: { id: { in: assignmentIds }, deletedAt: null },
    select: { id: true, serviceClientId: true },
  })
  if (rows.length !== assignmentIds.length) {
    throw new CrmAccessError('Session not found', 404)
  }
  await assertScheduleClientsEdit(
    user,
    rows.map((r) => r.serviceClientId)
  )
}
