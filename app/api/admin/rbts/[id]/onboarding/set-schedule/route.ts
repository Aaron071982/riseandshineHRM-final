import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { slots } = await request.json() // Array of { dayOfWeek, hour } objects

    if (!Array.isArray(slots)) {
      return NextResponse.json(
        { error: 'Slots must be an array' },
        { status: 400 }
      )
    }

    // Validate hour range (14-21 = 2 PM to 9 PM)
    for (const slot of slots) {
      if (typeof slot.hour !== 'number' || slot.hour < 14 || slot.hour > 21) {
        return NextResponse.json(
          { error: 'Invalid hour: must be 14-21 (2 PM to 9 PM)' },
          { status: 400 }
        )
      }
      if (typeof slot.dayOfWeek !== 'number' || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        return NextResponse.json(
          { error: 'Invalid dayOfWeek: must be 0-6 (Sunday-Saturday)' },
          { status: 400 }
        )
      }
    }

    // Verify RBT profile exists
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    // Delete existing slots and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing availability slots
      await tx.availabilitySlot.deleteMany({
        where: { rbtProfileId: id },
      })

      // Create new slots
      if (slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: slots.map((slot: { dayOfWeek: number; hour: number }) => ({
            rbtProfileId: id,
            dayOfWeek: slot.dayOfWeek,
            hour: slot.hour,
          })),
        })
      }

      // Mark schedule as completed
      await tx.rBTProfile.update({
        where: { id },
        data: { scheduleCompleted: true },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Schedule set successfully',
    })
  } catch (error: any) {
    console.error('Error setting schedule:', error)
    return NextResponse.json(
      { error: 'Failed to set schedule' },
      { status: 500 }
    )
  }
}

