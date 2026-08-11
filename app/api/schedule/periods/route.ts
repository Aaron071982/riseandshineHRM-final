import { NextRequest, NextResponse } from 'next/server'
import { requireScheduleSession } from '@/lib/schedule/access'
import {
  deleteSchedulePeriod,
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

/** Soft-delete all sessions for a schedule period and remove it from the picker. */
export async function DELETE(request: NextRequest) {
  const auth = await requireScheduleSession()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  let periodStart = parseDate(searchParams.get('periodStart'))
  let periodEnd = parseDate(searchParams.get('periodEnd'))

  if ((!periodStart || !periodEnd) && request.headers.get('content-type')?.includes('json')) {
    try {
      const body = await request.json()
      periodStart = periodStart ?? parseDate(body?.periodStart ?? null)
      periodEnd = periodEnd ?? parseDate(body?.periodEnd ?? null)
    } catch {
      // ignore — fall through to validation
    }
  }

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      { error: 'periodStart and periodEnd required (YYYY-MM-DD)' },
      { status: 400 }
    )
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: 'periodEnd must be on or after periodStart' }, { status: 400 })
  }

  const result = await deleteSchedulePeriod({ periodStart, periodEnd })
  const periods = await listSchedulePeriods()
  const next = await getLatestPeriodRange()

  return NextResponse.json({
    success: true,
    ...result,
    periods,
    nextPeriod: next
      ? {
          periodStart: next.periodStart.toISOString().slice(0, 10),
          periodEnd: next.periodEnd.toISOString().slice(0, 10),
        }
      : null,
  })
}
