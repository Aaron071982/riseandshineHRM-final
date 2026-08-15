import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { getVisibleClientsWhere } from '@/lib/crm/access'
import { logClientAccess } from '@/lib/client-services/audit'
import {
  deriveMetricsForClients,
  getHoursGapThreshold,
} from '@/lib/client-services/serviceStatus'
import { getUnlinkedScheduleClientNames } from '@/lib/client-services/scheduleSync'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type RangeKey = '7' | '30' | '90' | 'all'

function parseRange(raw: string | null): RangeKey {
  if (raw === '7' || raw === '30' || raw === '90' || raw === 'all') return raw
  return '30'
}

function rangeWindow(range: RangeKey): { start: Date | null; prevStart: Date | null; prevEnd: Date | null } {
  if (range === 'all') return { start: null, prevStart: null, prevEnd: null }
  const days = Number(range)
  const end = new Date()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days)
  const prevEnd = new Date(start)
  const prevStart = new Date(start)
  prevStart.setDate(prevStart.getDate() - days)
  return { start, prevStart, prevEnd }
}

function trendFromCounts(current: number, previous: number): {
  direction: 'up' | 'down' | 'neutral'
  percentChange: number
} {
  if (previous === 0 && current === 0) return { direction: 'neutral', percentChange: 0 }
  if (previous === 0) return { direction: 'up', percentChange: 100 }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { direction: 'neutral', percentChange: 0 }
  return { direction: pct > 0 ? 'up' : 'down', percentChange: Math.abs(pct) }
}

export async function GET(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  const range = parseRange(request.nextUrl.searchParams.get('range'))
  const window = rangeWindow(range)

  const scopeWhere: Prisma.ServiceClientWhereInput = getVisibleClientsWhere(user)

  const [clients, threshold, period] = await Promise.all([
    prisma.serviceClient.findMany({
      where: scopeWhere,
      include: {
        btAssignments: { where: { status: 'ACTIVE' }, select: { btName: true } },
        documents: { select: { collected: true } },
      },
    }),
    getHoursGapThreshold(),
    getClientSchedulePeriod(),
  ])

  const scopedIds = clients.map((c) => c.id)

  const [metricsMap, unlinked] = await Promise.all([
    deriveMetricsForClients(
      clients.map((c) => ({
        id: c.id,
        status: c.status,
        authHours: c.authHours,
        btAssignments: c.btAssignments,
      })),
      threshold,
      period
    ),
    getUnlinkedScheduleClientNames(period),
  ])

  let noService = 0
  let needsRbt = 0
  let needsHours = 0
  let receiving = 0
  let unlinkedClients = 0
  let unfilledAuthHours = 0
  let clientBreaks = 0
  let clientBreaksOverdue = 0
  let rbtBreaks = 0
  let rbtBreaksNoCoverage = 0
  let incompleteDocs = 0

  for (const c of clients) {
    const m = metricsMap.get(c.id)!
    if (m.notBeingServed) noService++
    if (m.needsRbt) needsRbt++
    if (m.needsAdditionalHours) {
      needsHours++
      if (m.hoursGap != null && m.hoursGap > 0) unfilledAuthHours += m.hoursGap
    }
    if (m.receivingServices) receiving++
    if (!m.scheduleLinked && c.status === 'ACTIVE') unlinkedClients++
    if (m.activeClientBreak) {
      clientBreaks++
      if (m.activeClientBreak.overdue) clientBreaksOverdue++
    }
    if (m.activeRbtBreaks.length > 0) {
      rbtBreaks++
      if (m.activeRbtBreaks.some((b) => !b.hasCoverage)) rbtBreaksNoCoverage++
    }
    const collected = c.documents.filter((d) => d.collected).length
    if (c.status === 'ACTIVE' && collected < 9) incompleteDocs++
  }

  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const authExpiring = await prisma.serviceClient.count({
    where: {
      ...scopeWhere,
      status: { in: ['ACTIVE', 'ON_HOLD'] },
      serviceEndDate: { gte: today, lte: in30 },
    },
  })

  const totalScoped = clients.length
  const byStatus = await prisma.serviceClient.groupBy({
    by: ['status'],
    where: scopeWhere,
    _count: { _all: true },
  })

  const byBucket: Record<string, number> = {}
  for (const c of clients) {
    const b = metricsMap.get(c.id)!.boardBucket
    byBucket[b] = (byBucket[b] ?? 0) + 1
  }

  // Range-scoped: new clients + breaks started
  const clientCreatedWhere: Prisma.ServiceClientWhereInput = {
    ...scopeWhere,
    ...(window.start ? { createdAt: { gte: window.start } } : {}),
  }
  const clientPrevWhere: Prisma.ServiceClientWhereInput | null =
    window.prevStart && window.prevEnd
      ? {
          ...scopeWhere,
          createdAt: { gte: window.prevStart, lt: window.prevEnd },
        }
      : null

  const breakWhereBase = { serviceClientId: { in: scopedIds.length ? scopedIds : ['__none__'] } }

  const [newClients, newClientsPrev, breaksNow, breaksPrev] = await Promise.all([
    prisma.serviceClient.count({ where: clientCreatedWhere }),
    clientPrevWhere
      ? prisma.serviceClient.count({ where: clientPrevWhere })
      : Promise.resolve(0),
    window.start
      ? prisma.clientServiceBreak.count({
          where: { ...breakWhereBase, startDate: { gte: window.start } },
        })
      : prisma.clientServiceBreak.count({ where: breakWhereBase }),
    window.prevStart && window.prevEnd
      ? prisma.clientServiceBreak.count({
          where: {
            ...breakWhereBase,
            startDate: { gte: window.prevStart, lt: window.prevEnd },
          },
        })
      : Promise.resolve(0),
  ])

  const pendingActions = needsRbt + needsHours + unlinkedClients + incompleteDocs

  await logClientAccess({
    userId: user.id,
    action: 'DASHBOARD_VIEW',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({
    alerts: {
      activeNoBt: needsRbt,
      incompleteDocuments: incompleteDocs,
      authExpiring30Days: authExpiring,
      noServiceThisPeriod: noService,
      needsRbt,
      needsAdditionalHours: needsHours,
      receivingServices: receiving,
      unfilledAuthHours: Math.round(unfilledAuthHours * 100) / 100,
      clientsOnBreak: clientBreaks,
      clientsOnBreakOverdue: clientBreaksOverdue,
      rbtBreaksActive: rbtBreaks,
      rbtBreaksNoCoverage,
      unlinkedScheduleClients: unlinked.length,
      clientsNotLinkedToSchedule: unlinkedClients,
    },
    summaryBoard: {
      range,
      metrics: [
        {
          key: 'totalClients',
          label: 'Total Clients',
          value: totalScoped,
          trend: trendFromCounts(newClients, newClientsPrev),
          accent: null as string | null,
        },
        {
          key: 'newClients',
          label: 'New Clients',
          value: newClients,
          trend: trendFromCounts(newClients, newClientsPrev),
          accent: null,
        },
        {
          key: 'receiving',
          label: 'Receiving',
          value: receiving,
          trend: { direction: 'neutral' as const, percentChange: 0 },
          accent: 'green',
        },
        {
          key: 'needsRbt',
          label: 'Need an RBT',
          value: needsRbt,
          trend: { direction: 'neutral' as const, percentChange: 0 },
          accent: 'urgent',
        },
        {
          key: 'needsHours',
          label: 'Need Hours',
          value: needsHours,
          trend: { direction: 'neutral' as const, percentChange: 0 },
          accent: null,
        },
        {
          key: 'pendingActions',
          label: 'Pending Actions',
          value: pendingActions,
          trend: trendFromCounts(breaksNow, breaksPrev),
          accent: 'brand',
        },
      ],
    },
    hoursGapThreshold: threshold,
    schedulePeriod: {
      start: period.start,
      end: period.end,
      label: period.label,
    },
    unlinkedScheduleClients: unlinked,
    totals: {
      clients: totalScoped,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byBucket,
    },
  })
}

