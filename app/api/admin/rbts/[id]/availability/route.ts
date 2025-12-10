import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// GET: Admin can view any RBT's availability slots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params // This is the RBTProfile ID
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify RBT profile exists
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        rbtProfileId: id,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { hour: 'asc' },
      ],
    })

    return NextResponse.json({
      rbtProfile: {
        id: rbtProfile.id,
        firstName: rbtProfile.firstName,
        lastName: rbtProfile.lastName,
        email: rbtProfile.email,
        scheduleCompleted: rbtProfile.scheduleCompleted,
      },
      slots,
    })
  } catch (error) {
    console.error('Error fetching RBT availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RBT availability' },
      { status: 500 }
    )
  }
}

