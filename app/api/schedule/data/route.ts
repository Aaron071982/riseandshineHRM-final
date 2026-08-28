import { NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import {
  fetchUserCrmRoles,
  getVisibleClientsWhere,
  isFullAccess,
} from '@/lib/crm/access'
import { prisma } from '@/lib/prisma'
import { getLatestPeriodRange, loadPeriodWorkspaceData } from '@/lib/schedule-import/periodData'

export const dynamic = 'force-dynamic'

async function liveClientScope(user: {
  id: string
  email?: string | null
  crmRoles?: import('@prisma/client').CrmRole[]
}) {
  const crmRoles = user.crmRoles ?? (await fetchUserCrmRoles(user.id))
  const subject = { id: user.id, email: user.email, crmRoles }
  if (isFullAccess(subject)) return 'ALL' as const
  const visible = await prisma.serviceClient.findMany({
    where: { ...getVisibleClientsWhere(subject), pipelineStatus: 'LIVE' },
    select: { id: true },
  })
  return visible.map((c) => c.id)
}

export async function GET() {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const latest = await getLatestPeriodRange()
  const liveClientIds = await liveClientScope(auth.user)
  const data = await loadPeriodWorkspaceData({
    periodStart: latest?.periodStart ?? null,
    periodEnd: latest?.periodEnd ?? null,
    liveClientIds,
  })

  return NextResponse.json(data)
}
