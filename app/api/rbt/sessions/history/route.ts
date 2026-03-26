import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { durationSeconds, formatDurationHM, getEasternMonthStart, getEasternWeekStart, sessionStatus } from '@/lib/attendance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10))
    const limit = Math.min(30, Math.max(1, Number.parseInt(params.get('limit') || '30', 10)))
    const skip = (page - 1) * limit

    const where = { rbtProfileId: user.rbtProfileId }
    const [rows, totalSessions, weekAgg, monthAgg] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        orderBy: { clockInTime: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          clockInTime: true,
          clockOutTime: true,
          totalHours: true,
          source: true,
        },
      }),
      prisma.timeEntry.count({ where }),
      prisma.timeEntry.aggregate({
        where: { ...where, clockInTime: { gte: getEasternWeekStart() } },
        _sum: { totalHours: true },
      }),
      prisma.timeEntry.aggregate({
        where: { ...where, clockInTime: { gte: getEasternMonthStart() } },
        _sum: { totalHours: true },
      }),
    ])

    const entries = rows.map((row) => {
      const seconds = durationSeconds(row.clockInTime, row.clockOutTime)
      return {
        ...row,
        durationSeconds: seconds,
        durationLabel: formatDurationHM(seconds),
        status: sessionStatus(row.clockInTime, row.clockOutTime),
      }
    })

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total: totalSessions,
        totalPages: Math.max(1, Math.ceil(totalSessions / limit)),
      },
      summary: {
        hoursThisWeek: weekAgg._sum.totalHours ?? 0,
        hoursThisMonth: monthAgg._sum.totalHours ?? 0,
        totalSessions,
      },
    })
  } catch (error) {
    console.error('GET /api/rbt/sessions/history failed:', error)
    return NextResponse.json({ error: 'Failed to load session history' }, { status: 500 })
  }
}
