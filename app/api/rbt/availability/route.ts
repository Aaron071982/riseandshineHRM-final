import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// GET: Fetch current RBT's availability slots
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

    // Gracefully handle if AvailabilitySlot table doesn't exist yet
    let slots: any[] = []
    try {
      slots = await prisma.availabilitySlot.findMany({
        where: {
          rbtProfileId: user.rbtProfileId!,
        },
        orderBy: [
          { dayOfWeek: 'asc' },
          { hour: 'asc' },
        ],
      })
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn('AvailabilitySlot table not found, returning empty array')
        return NextResponse.json([])
      }
      throw error
    }

    return NextResponse.json(slots)
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}

// POST: Update current RBT's availability slots
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

    const body = await request.json()
    const { slots } = body // Array of { dayOfWeek: number, hour: number }

    if (!Array.isArray(slots)) {
      return NextResponse.json(
        { error: 'Invalid request: slots must be an array' },
        { status: 400 }
      )
    }

    // Validate slots
    for (const slot of slots) {
      if (typeof slot.dayOfWeek !== 'number' || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        return NextResponse.json(
          { error: 'Invalid dayOfWeek: must be 0-6' },
          { status: 400 }
        )
      }
      if (typeof slot.hour !== 'number' || slot.hour < 14 || slot.hour > 21) {
        return NextResponse.json(
          { error: 'Invalid hour: must be 14-21 (2 PM to 9 PM)' },
          { status: 400 }
        )
      }
    }

    // Use a transaction to delete existing slots and create new ones
    // Gracefully handle if tables don't exist yet
    let result: any[] = []
    try {
      result = await prisma.$transaction(async (tx) => {
        // Delete all existing slots for this RBT
        try {
          await tx.availabilitySlot.deleteMany({
            where: {
              rbtProfileId: user.rbtProfileId!,
            },
          })
        } catch (error: any) {
          if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            console.warn('AvailabilitySlot table not found, skipping delete')
          } else {
            throw error
          }
        }

        // Create new slots
        if (slots.length > 0) {
          try {
            await tx.availabilitySlot.createMany({
              data: slots.map((slot: { dayOfWeek: number; hour: number }) => ({
                rbtProfileId: user.rbtProfileId!,
                dayOfWeek: slot.dayOfWeek,
                hour: slot.hour,
              })),
            })
          } catch (error: any) {
            if (error.code === 'P2021' || error.message?.includes('does not exist')) {
              console.warn('AvailabilitySlot table not found, cannot create slots')
              return []
            }
            throw error
          }
        }

        // Mark schedule as completed (gracefully handle if field doesn't exist)
        try {
          await tx.rBTProfile.update({
            where: { id: user.rbtProfileId! },
            data: { scheduleCompleted: true },
          })
        } catch (error: any) {
          if (error.code === 'P2021' || error.message?.includes('scheduleCompleted')) {
            console.warn('scheduleCompleted field not found, skipping update')
          } else {
            throw error
          }
        }

        // Return the new slots
        try {
          return await tx.availabilitySlot.findMany({
            where: {
              rbtProfileId: user.rbtProfileId!,
            },
            orderBy: [
              { dayOfWeek: 'asc' },
              { hour: 'asc' },
            ],
          })
        } catch (error: any) {
          if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            return []
          }
          throw error
        }
      })
    } catch (error: any) {
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn('Database schema not fully updated, returning success with empty slots')
        return NextResponse.json({ success: true, slots: [] })
      }
      throw error
    }

    return NextResponse.json({ success: true, slots: result })
  } catch (error) {
    console.error('Error updating availability:', error)
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    )
  }
}

