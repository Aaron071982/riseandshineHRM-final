import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  enforceClientScope,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { softDeleteData } from '@/lib/crm/softDelete'
import { assertCanEditClient, fetchUserCrmRoles } from '@/lib/crm/access'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Replace or update care team: BCBA, CC, BT list */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied
  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    await assertCanEditClient({ ...user, crmRoles }, id)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    bcbaName?: string | null
    caseCoordinatorName?: string | null
    btNames?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data: { bcbaName?: string | null; caseCoordinatorName?: string | null } = {}
  if ('bcbaName' in body) data.bcbaName = body.bcbaName?.trim() || null
  if ('caseCoordinatorName' in body) {
    data.caseCoordinatorName = body.caseCoordinatorName?.trim() || null
  }

  if (Object.keys(data).length > 0) {
    await prisma.serviceClient.update({ where: { id }, data })
  }

  if (Array.isArray(body.btNames)) {
    await prisma.serviceClientBtAssignment.updateMany({
      where: { serviceClientId: id, deletedAt: null },
      data: { ...softDeleteData(user.id), status: 'ENDED' },
    })
    const names = body.btNames.map((n) => n.trim()).filter(Boolean)
    if (names.length > 0) {
      await prisma.serviceClientBtAssignment.createMany({
        data: names.map((btName, idx) => ({
          serviceClientId: id,
          btName,
          isPrimary: idx === 0,
          status: 'ACTIVE' as const,
        })),
      })
    }
    const { addClientTimelineNote } = await import('@/lib/client-services/timeline')
    await addClientTimelineNote({
      serviceClientId: id,
      authorId: user.id,
      content:
        names.length > 0
          ? `[Care team] BTs assigned: ${names.join(', ')}`
          : '[Care team] All BTs removed',
    })
  }

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'CARE_TEAM_EDIT',
    ip: getClientIpFromRequest(request),
  })

  const client = await prisma.serviceClient.findUnique({
    where: { id },
        include: { btAssignments: { where: { status: 'ACTIVE', deletedAt: null } } },
  })

  return NextResponse.json({ client })
}
