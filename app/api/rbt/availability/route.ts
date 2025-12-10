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

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        rbtProfileId: user.rbtProfileId!,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { hour: 'asc' },
      ],
    })

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
      if (typeof slot.hour !== 'number' || slot.hour < 9 || slot.hour > 19) {
        return NextResponse.json(
          { error: 'Invalid hour: must be 9-19' },
          { status: 400 }
        )
      }
    }

    // Use a transaction to delete existing slots and create new ones
    const result = await prisma.$transaction(async (tx) => {
      // Delete all existing slots for this RBT
      await tx.availabilitySlot.deleteMany({
        where: {
          rbtProfileId: user.rbtProfileId!,
        },
      })

      // Create new slots
      if (slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: slots.map((slot: { dayOfWeek: number; hour: number }) => ({
            rbtProfileId: user.rbtProfileId!,
            dayOfWeek: slot.dayOfWeek,
            hour: slot.hour,
          })),
        })
      }

      // Mark schedule as completed
      await tx.rBTProfile.update({
        where: { id: user.rbtProfileId! },
        data: { scheduleCompleted: true },
      })

      // Return the new slots
      return await tx.availabilitySlot.findMany({
        where: {
          rbtProfileId: user.rbtProfileId!,
        },
        orderBy: [
          { dayOfWeek: 'asc' },
          { hour: 'asc' },
        ],
      })
    })

    return NextResponse.json({ success: true, slots: result })
  } catch (error) {
    console.error('Error updating availability:', error)
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    )
  }
}

