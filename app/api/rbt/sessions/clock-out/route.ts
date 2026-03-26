import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { durationSeconds, formatDurationHM } from '@/lib/attendance'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const openEntry = await prisma.timeEntry.findFirst({
      where: { rbtProfileId: user.rbtProfileId, clockOutTime: null },
      orderBy: { clockInTime: 'desc' },
    })

    if (!openEntry) {
      return NextResponse.json({ error: 'No active session found' }, { status: 400 })
    }

    const clockOutTime = new Date()
    const seconds = durationSeconds(openEntry.clockInTime, clockOutTime)
    const totalHours = Math.round((seconds / 3600) * 100) / 100

    const updated = await prisma.timeEntry.update({
      where: { id: openEntry.id },
      data: { clockOutTime, totalHours },
      select: {
        id: true,
        rbtProfileId: true,
        clockInTime: true,
        clockOutTime: true,
        totalHours: true,
        source: true,
      },
    })

    return NextResponse.json({
      timeEntry: updated,
      durationSeconds: seconds,
      durationLabel: formatDurationHM(seconds),
    })
  } catch (error) {
    console.error('POST /api/rbt/sessions/clock-out failed:', error)
    return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 })
  }
}
