import { NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import { getLatestPeriodRange, loadPeriodWorkspaceData } from '@/lib/schedule-import/periodData'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const latest = await getLatestPeriodRange()
  const data = await loadPeriodWorkspaceData({
    periodStart: latest?.periodStart ?? null,
    periodEnd: latest?.periodEnd ?? null,
    liveClientIds: 'ALL',
  })

  return NextResponse.json(data)
}
