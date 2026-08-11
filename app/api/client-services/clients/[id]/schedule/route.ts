import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  enforceClientScope,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { DAY_LABELS, formatTime12h, hoursBetween } from '@/lib/rbt-schedule/utils'
import {
  deriveClientMetrics,
  getHoursGapThreshold,
  rbtDisplayName,
} from '@/lib/client-services/serviceStatus'
import {
  getClientSchedulePeriod,
  schedulePeriodWhere,
} from '@/lib/client-services/schedulePeriod'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  const client = await prisma.serviceClient.findUnique({
    where: { id },
    include: { btAssignments: { where: { status: 'ACTIVE' } } },
  })
  if (!client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [period, threshold] = await Promise.all([
    getClientSchedulePeriod(),
    getHoursGapThreshold(),
  ])

  const [assignments, linkedAny, clientBreaks, rbtBreaks] = await Promise.all([
    prisma.rbtScheduleAssignment.findMany({
      where: {
        ...schedulePeriodWhere(period),
        serviceClientId: id,
      },
      include: {
        rbtProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            artemisProviderName: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.rbtScheduleAssignment.count({
      where: { isActive: true, serviceClientId: id },
    }),
    prisma.clientServiceBreak.findMany({
      where: { serviceClientId: id, status: 'ON_BREAK' },
    }),
    prisma.clientRbtBreak.findMany({
      where: { serviceClientId: id, status: 'ON_BREAK' },
    }),
  ])

  const metrics = deriveClientMetrics({
    status: client.status,
    authHours: client.authHours,
    careTeamBtNames: client.btAssignments.map((b) => b.btName),
    scheduleSlots: assignments.map((a) => ({
      startTime: a.startTime,
      endTime: a.endTime,
      isActive: a.isActive,
      rbtProfile: a.rbtProfile,
    })),
    clientBreaks,
    rbtBreaks,
    hoursGapThreshold: threshold,
    scheduleLinked: linkedAny > 0,
    period,
  })

  const sessions = assignments.map((a) => ({
    id: a.id,
    clientName: a.clientName,
    dayOfWeek: a.dayOfWeek,
    dayLabel: DAY_LABELS[a.dayOfWeek] ?? String(a.dayOfWeek),
    startTime: a.startTime,
    endTime: a.endTime,
    startLabel: formatTime12h(a.startTime),
    endLabel: formatTime12h(a.endTime),
    hours: hoursBetween(a.startTime, a.endTime),
    btName: rbtDisplayName(a.rbtProfile),
    rbtProfileId: a.rbtProfileId,
    periodStart: a.periodStart,
    periodEnd: a.periodEnd,
    location: a.location,
    source: a.source,
  }))

  const linkedNames = [...new Set(assignments.map((a) => a.clientName))]

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'CLIENT_SCHEDULE_VIEW',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({
    sessions,
    linkedScheduleNames: linkedNames,
    metrics,
    hoursGapThreshold: threshold,
    schedulePeriod: {
      start: period.start,
      end: period.end,
      label: period.label,
    },
  })
}
