import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  CrmAccessError,
} from '@/lib/crm/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { pairAttendanceVisits } from '@/lib/crm/clientAttendance'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id } = await context.params

  try {
    await assertCanViewClient(user, id)
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: err.status })
    }
    throw err
  }

  const client = await prisma.serviceClient.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'VIEW_ATTENDANCE',
    ip: getClientIpFromRequest(request),
  })

  const rows = await prisma.clientAttendanceEvent.findMany({
    where: { serviceClientId: id },
    orderBy: { eventAt: 'asc' },
  })

  const paired = pairAttendanceVisits(rows)

  return NextResponse.json({
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
    },
    ...paired,
  })
}
