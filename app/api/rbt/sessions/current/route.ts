import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { durationSeconds, formatDurationHM, sessionStatus } from '@/lib/attendance'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const current = await prisma.timeEntry.findFirst({
      where: { rbtProfileId: user.rbtProfileId, clockOutTime: null },
      orderBy: { clockInTime: 'desc' },
      select: {
        id: true,
        clockInTime: true,
        clockOutTime: true,
        source: true,
        createdAt: true,
      },
    })

    if (!current) {
      return NextResponse.json({ current: null })
    }

    const seconds = durationSeconds(current.clockInTime, current.clockOutTime)
    return NextResponse.json({
      current: {
        ...current,
        durationSeconds: seconds,
        durationLabel: formatDurationHM(seconds),
        status: sessionStatus(current.clockInTime, current.clockOutTime),
      },
    })
  } catch (error) {
    console.error('GET /api/rbt/sessions/current failed:', error)
    return NextResponse.json({ error: 'Failed to load current session' }, { status: 500 })
  }
}
