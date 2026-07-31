import { NextRequest, NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import {
  getLatestPeriodRange,
  listSchedulePeriods,
  loadPeriodWorkspaceData,
} from '@/lib/schedule-import/periodData'

export const dynamic = 'force-dynamic'

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export async function GET(request: NextRequest) {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const borough = searchParams.get('borough')
  let periodStart = parseDate(searchParams.get('periodStart'))
  let periodEnd = parseDate(searchParams.get('periodEnd'))

  const periods = await listSchedulePeriods()

  if (!periodStart || !periodEnd) {
    const latest = await getLatestPeriodRange()
    if (latest) {
      periodStart = latest.periodStart
      periodEnd = latest.periodEnd
    }
  }

  const data = await loadPeriodWorkspaceData({
    periodStart,
    periodEnd,
    boroughFilter: borough,
  })

  return NextResponse.json({ ...data, periods })
}
