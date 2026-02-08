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

    // Verify RBT profile exists and get slots
    let rbtProfile: { id: string; firstName: string; lastName: string; email: string | null; scheduleCompleted: boolean } | null = null
    let slots: Array<{ dayOfWeek: number; hour: number }> = []

    try {
      const profile = await prisma.rBTProfile.findUnique({
        where: { id },
        select: { id: true, firstName: true, lastName: true, email: true, scheduleCompleted: true },
      })
      if (profile) rbtProfile = profile

      if (rbtProfile) {
        try {
          const slotRows = await prisma.availabilitySlot.findMany({
            where: { rbtProfileId: id },
            orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }],
            select: { dayOfWeek: true, hour: true },
          })
          slots = slotRows
        } catch (slotErr: any) {
          if (slotErr.code === 'P2021' || slotErr.message?.includes('does not exist')) {
            console.warn('AvailabilitySlot table not found, returning empty slots')
          } else {
            throw slotErr
          }
        }
      }
    } catch (err) {
      console.error('Error fetching RBT availability (Prisma), trying raw SQL', err)
      try {
        const [profileRow] = await prisma.$queryRaw<
          Array<{ id: string; firstName: string; lastName: string; email: string | null; scheduleCompleted: boolean }>
        >`SELECT id, "firstName", "lastName", email, "scheduleCompleted" FROM rbt_profiles WHERE id = ${id}`
        if (profileRow) rbtProfile = profileRow
        const slotRows = await prisma.$queryRaw<Array<{ dayOfWeek: number; hour: number }>>`
          SELECT "dayOfWeek", hour FROM availability_slots WHERE "rbtProfileId" = ${id} ORDER BY "dayOfWeek", hour
        `.catch(() => [])
        slots = Array.isArray(slotRows) ? slotRows : []
      } catch (rawErr) {
        console.error('Error fetching RBT availability (raw)', rawErr)
        return NextResponse.json(
          { error: 'Failed to fetch RBT availability' },
          { status: 500 }
        )
      }
    }

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

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

