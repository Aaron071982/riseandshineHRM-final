import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// GET: Retrieve time entries for the authenticated RBT
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        rbtProfileId: user.rbtProfileId,
      },
      include: {
        shift: {
          select: {
            id: true,
            clientName: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: {
        clockInTime: 'desc',
      },
      take: limit,
      skip: offset,
    })

    return NextResponse.json({ timeEntries })
  } catch (error) {
    console.error('Error fetching time entries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time entries' },
      { status: 500 }
    )
  }
}

// POST: Create a new time entry (clock in or clock out)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const { action, shiftId, clockInTime, clockOutTime, source } = data

    // Validate action
    if (action !== 'clock_in' && action !== 'clock_out') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "clock_in" or "clock_out"' },
        { status: 400 }
      )
    }

    if (action === 'clock_in') {
      // Check if there's an active time entry (clocked in but not clocked out)
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          rbtProfileId: user.rbtProfileId,
          clockOutTime: null,
        },
        orderBy: {
          clockInTime: 'desc',
        },
      })

      if (activeEntry) {
        return NextResponse.json(
          { error: 'You are already clocked in. Please clock out first.' },
          { status: 400 }
        )
      }

      // Create new time entry
      const timeEntry = await prisma.timeEntry.create({
        data: {
          rbtProfileId: user.rbtProfileId,
          shiftId: shiftId || null,
          clockInTime: clockInTime ? new Date(clockInTime) : new Date(),
          source: source === 'MOBILE_APP' ? 'MOBILE_APP' : 'WEB_MANUAL',
        },
        include: {
          shift: {
            select: {
              id: true,
              clientName: true,
            },
          },
        },
      })

      return NextResponse.json({ success: true, timeEntry })
    } else {
      // Clock out: Find the most recent active time entry
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          rbtProfileId: user.rbtProfileId,
          clockOutTime: null,
        },
        orderBy: {
          clockInTime: 'desc',
        },
      })

      if (!activeEntry) {
        return NextResponse.json(
          { error: 'No active clock-in found. Please clock in first.' },
          { status: 400 }
        )
      }

      // Calculate total hours
      const clockOut = clockOutTime ? new Date(clockOutTime) : new Date()
      const clockIn = new Date(activeEntry.clockInTime)
      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)

      // Update time entry
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          clockOutTime: clockOut,
          totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        },
        include: {
          shift: {
            select: {
              id: true,
              clientName: true,
            },
          },
        },
      })

      return NextResponse.json({ success: true, timeEntry: updatedEntry })
    }
  } catch (error) {
    console.error('Error creating/updating time entry:', error)
    return NextResponse.json(
      { error: 'Failed to process time entry' },
      { status: 500 }
    )
  }
}
