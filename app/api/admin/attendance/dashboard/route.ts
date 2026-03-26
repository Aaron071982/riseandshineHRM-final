import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { durationSeconds, formatDurationHM, getEasternMonthStart, getEasternWeekStart } from '@/lib/attendance'

/** Hired RBTs only (matches Postgres `RBTStatus` enum). If you add `ONBOARDING_COMPLETED` to the DB enum, you can extend this filter. */

export const dynamic = 'force-dynamic'

type StatusFilter = 'ALL' | 'CLOCKED_IN' | 'FLAGGED'

function parseDateRange(request: NextRequest): { start: Date; end: Date } {
  const range = request.nextUrl.searchParams.get('range') || 'this_month'
  const now = new Date()
  if (range === 'this_week') return { start: getEasternWeekStart(now), end: now }
  if (range === 'custom') {
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')
    if (startDate && endDate) {
      return {
        start: new Date(`${startDate}T00:00:00.000Z`),
        end: new Date(`${endDate}T23:59:59.999Z`),
      }
    }
  }
  return { start: getEasternMonthStart(now), end: now }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()
    const status = (request.nextUrl.searchParams.get('status') || 'ALL') as StatusFilter
    const flaggedOnly = request.nextUrl.searchParams.get('flaggedOnly') === '1'
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10))
    const limit = Math.min(10000, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)))
    const { start, end } = parseDateRange(request)
    const now = new Date()

    const employedRbts = await prisma.rBTProfile.findMany({
      where: {
        status: 'HIRED',
      },
      select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    const rbtIds = employedRbts.map((r) => r.id)

    const [allEntriesForEmployed, rangeEntries] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { rbtProfileId: { in: rbtIds } },
        select: { id: true, rbtProfileId: true, clockInTime: true, clockOutTime: true, totalHours: true, source: true },
        orderBy: { clockInTime: 'desc' },
      }),
      prisma.timeEntry.findMany({
        where: { rbtProfileId: { in: rbtIds }, clockInTime: { gte: start, lte: end } },
        select: { id: true, rbtProfileId: true, clockInTime: true, clockOutTime: true, totalHours: true, source: true },
        orderBy: { clockInTime: 'desc' },
      }),
    ])

    const weekStart = getEasternWeekStart(now)
    const monthStart = getEasternMonthStart(now)
    const byRbt = new Map<string, typeof allEntriesForEmployed>()
    for (const entry of allEntriesForEmployed) {
      if (!byRbt.has(entry.rbtProfileId)) byRbt.set(entry.rbtProfileId, [])
      byRbt.get(entry.rbtProfileId)!.push(entry)
    }

    const summaryRowsRaw = employedRbts.map((rbt) => {
      const entries = byRbt.get(rbt.id) || []
      const open = entries.find((e) => e.clockOutTime == null) || null
      const lastClockIn = entries[0]?.clockInTime ?? null
      const weekHours = entries
        .filter((e) => e.clockInTime >= weekStart && e.totalHours != null)
        .reduce((sum, e) => sum + (e.totalHours ?? 0), 0)
      const monthHours = entries
        .filter((e) => e.clockInTime >= monthStart && e.totalHours != null)
        .reduce((sum, e) => sum + (e.totalHours ?? 0), 0)
      const totalSessions = entries.length
      let statusLabel: 'CLOCKED_IN' | 'CLOCKED_OUT' | 'FORGOT_CLOCK_OUT' | 'LONG_SESSION' = 'CLOCKED_OUT'
      let elapsedHours: number | null = null
      if (open) {
        elapsedHours = durationSeconds(open.clockInTime, null) / 3600
        if (elapsedHours >= 12) statusLabel = 'FORGOT_CLOCK_OUT'
        else if (elapsedHours >= 8) statusLabel = 'LONG_SESSION'
        else statusLabel = 'CLOCKED_IN'
      }
      return {
        rbtProfileId: rbt.id,
        rbtName: `${rbt.firstName} ${rbt.lastName}`,
        email: rbt.email,
        phoneNumber: rbt.phoneNumber,
        hoursThisWeek: weekHours,
        hoursThisMonth: monthHours,
        totalSessions,
        lastClockIn,
        status: statusLabel,
        elapsedHours,
      }
    })

    const summaryRows = summaryRowsRaw.filter((row) => {
      if (search && !row.rbtName.toLowerCase().includes(search)) return false
      if (status === 'CLOCKED_IN' && row.status === 'CLOCKED_OUT') return false
      if (status === 'FLAGGED' && !['FORGOT_CLOCK_OUT', 'LONG_SESSION'].includes(row.status)) return false
      return true
    })

    const detailedRowsRaw = rangeEntries.map((entry) => {
      const rbt = employedRbts.find((r) => r.id === entry.rbtProfileId)
      const open = !entry.clockOutTime
      const elapsedSeconds = durationSeconds(entry.clockInTime, entry.clockOutTime)
      const elapsedHours = elapsedSeconds / 3600
      const noClockOutFlag = open && elapsedHours >= 12
      const longSessionFlag = (open && elapsedHours >= 8) || (!open && (entry.totalHours ?? 0) > 8)
      return {
        id: entry.id,
        rbtProfileId: entry.rbtProfileId,
        rbtName: rbt ? `${rbt.firstName} ${rbt.lastName}` : 'Unknown',
        email: rbt?.email ?? null,
        phoneNumber: rbt?.phoneNumber ?? null,
        clockInTime: entry.clockInTime,
        clockOutTime: entry.clockOutTime,
        totalHours: entry.totalHours,
        durationHours: Math.round(elapsedHours * 100) / 100,
        durationLabel: formatDurationHM(elapsedSeconds),
        source: entry.source,
        noClockOutFlag,
        longSessionFlag,
      }
    })

    const detailedFiltered = detailedRowsRaw.filter((row) => {
      if (search && !row.rbtName.toLowerCase().includes(search)) return false
      if (flaggedOnly && !(row.noClockOutFlag || row.longSessionFlag)) return false
      if (status === 'CLOCKED_IN' && row.clockOutTime != null) return false
      if (status === 'FLAGGED' && !(row.noClockOutFlag || row.longSessionFlag)) return false
      return true
    })

    const detailedTotal = detailedFiltered.length
    const detailedRows = detailedFiltered.slice((page - 1) * limit, (page - 1) * limit + limit)

    const totalClockedInNow = summaryRowsRaw.filter((r) => r.status !== 'CLOCKED_OUT').length
    const flaggedSessionsCount = summaryRowsRaw.filter((r) => ['FORGOT_CLOCK_OUT', 'LONG_SESSION'].includes(r.status)).length
    const totalHoursWeekAll = summaryRowsRaw.reduce((sum, r) => sum + r.hoursThisWeek, 0)
    const totalHoursMonthAll = summaryRowsRaw.reduce((sum, r) => sum + r.hoursThisMonth, 0)

    return NextResponse.json({
      summaryRows,
      detailedRows,
      detailedPagination: {
        page,
        limit,
        total: detailedTotal,
        totalPages: Math.max(1, Math.ceil(detailedTotal / limit)),
      },
      cards: {
        totalClockedInNow,
        totalHoursWeekAll,
        totalHoursMonthAll,
        flaggedSessionsCount,
      },
    })
  } catch (error) {
    console.error('GET /api/admin/attendance/dashboard failed:', error)
    return NextResponse.json({ error: 'Failed to load attendance dashboard' }, { status: 500 })
  }
}
