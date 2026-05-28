import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: auth.user.rbtProfileId! },
    select: {
      artemisTrainingCompleted: true,
      artemisTrainingCompletedAt: true,
      artemisTrainingSession: {
        include: { host: { select: { name: true } } },
      },
    },
  })

  const now = new Date()
  const booking = await prisma.trainingBooking.findFirst({
    where: {
      rbtProfileId: auth.user.rbtProfileId!,
      attendanceStatus: 'BOOKED',
      trainingSession: {
        status: 'SCHEDULED',
        endTime: { gt: now },
      },
    },
    include: {
      trainingSession: {
        include: { host: { select: { name: true, email: true } } },
      },
    },
  })

  return NextResponse.json({
    profile,
    booking: booking
      ? {
          id: booking.id,
          bookedAt: booking.bookedAt,
          session: booking.trainingSession,
        }
      : null,
  })
}
