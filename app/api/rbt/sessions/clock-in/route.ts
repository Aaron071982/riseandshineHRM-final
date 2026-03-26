import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      select: { id: true },
    })

    if (openEntry) {
      return NextResponse.json(
        { error: 'You are already clocked in. Please clock out first before starting a new session.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const created = await prisma.timeEntry.create({
      data: {
        rbtProfileId: user.rbtProfileId,
        clockInTime: now,
        source: 'WEB_MANUAL',
      },
      select: {
        id: true,
        rbtProfileId: true,
        clockInTime: true,
        clockOutTime: true,
        totalHours: true,
        source: true,
      },
    })

    return NextResponse.json({ timeEntry: created })
  } catch (error) {
    console.error('POST /api/rbt/sessions/clock-in failed:', error)
    return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 })
  }
}
