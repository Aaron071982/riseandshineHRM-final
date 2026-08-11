import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import {
  getHoursGapThreshold,
  setHoursGapThreshold,
} from '@/lib/client-services/serviceStatus'
import {
  getClientSchedulePeriod,
  setClientSchedulePeriod,
} from '@/lib/client-services/schedulePeriod'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const [threshold, period] = await Promise.all([
    getHoursGapThreshold(),
    getClientSchedulePeriod(),
  ])
  return NextResponse.json({
    hoursGapThreshold: threshold,
    schedulePeriod: {
      start: period.start,
      end: period.end,
      label: period.label,
    },
  })
}

/**
 * Full-access only: update hours-gap threshold and/or schedule period.
 * Body: { hoursGapThreshold?: number, schedulePeriod?: { start, end } }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  if (!isClientServicesFullAccessEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    hoursGapThreshold?: number
    schedulePeriod?: { start?: string; end?: string }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let threshold = await getHoursGapThreshold()
  let period = await getClientSchedulePeriod()

  if (body.hoursGapThreshold != null) {
    const n = Number(body.hoursGapThreshold)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'hoursGapThreshold must be ≥ 0' }, { status: 400 })
    }
    await setHoursGapThreshold(n)
    threshold = n
    await logClientAccess({
      userId: user.id,
      action: 'HOURS_GAP_THRESHOLD_UPDATE',
      ip: getClientIpFromRequest(request),
    })
  }

  if (body.schedulePeriod?.start && body.schedulePeriod?.end) {
    try {
      period = await setClientSchedulePeriod(
        String(body.schedulePeriod.start),
        String(body.schedulePeriod.end)
      )
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid schedule period' },
        { status: 400 }
      )
    }
    await logClientAccess({
      userId: user.id,
      action: 'SCHEDULE_PERIOD_UPDATE',
      ip: getClientIpFromRequest(request),
    })
  }

  return NextResponse.json({
    hoursGapThreshold: threshold,
    schedulePeriod: {
      start: period.start,
      end: period.end,
      label: period.label,
    },
  })
}
