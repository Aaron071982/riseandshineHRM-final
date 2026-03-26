import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Returns list of admins who accept interview bookings and have at least one
 * active availability window. Used on the public schedule-interview Step 1.
 */
export async function GET(request: NextRequest) {
  try {
    const usersWithAvailability = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
        AND: [
          {
            OR: [
              { interviewerSettings: null },
              { interviewerSettings: { acceptInterviewBookings: true } },
            ],
          },
          { interviewerAvailability: { some: { isActive: true } } },
        ],
      },
      select: {
        id: true,
        name: true,
        interviewerAvailability: {
          where: { isActive: true },
          select: { dayOfWeek: true },
          distinct: ['dayOfWeek'],
        },
      },
    })

    const interviewers = usersWithAvailability.map((u) => {
      const firstName = (u.name || 'Interviewer').split(/\s+/)[0]
      const days = [...new Set(u.interviewerAvailability.map((a) => a.dayOfWeek))].sort((a, b) => a - b)
      return {
        id: u.id,
        firstName,
        daysOfWeek: days,
      }
    })

    return NextResponse.json(interviewers)
  } catch (error) {
    console.error('GET /api/public/interviewers', error)
    return NextResponse.json({ error: 'Failed to load interviewers' }, { status: 500 })
  }
}
