import { NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RBTStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    upcomingSessions,
    trainedCount,
    awaitingProfiles,
    monthSessions,
    recentBookings,
  ] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { status: { not: 'CANCELLED' }, endTime: { gte: now } },
      orderBy: { startTime: 'asc' },
      take: 5,
      include: { host: { select: { name: true } } },
    }),
    prisma.rBTProfile.count({
      where: { status: RBTStatus.HIRED, artemisTrainingCompleted: true },
    }),
    prisma.rBTProfile.findMany({
      where: {
        status: RBTStatus.HIRED,
        artemisTrainingCompleted: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    }),
    prisma.trainingSession.count({
      where: {
        startTime: { gte: monthStart },
        status: { not: 'CANCELLED' },
      },
    }),
    prisma.trainingBooking.findMany({
      orderBy: { bookedAt: 'desc' },
      take: 10,
      include: {
        rbtProfile: { select: { firstName: true, lastName: true } },
        trainingSession: { select: { title: true, startTime: true } },
      },
    }),
  ])

  const awaitingCount = await prisma.rBTProfile.count({
    where: { status: RBTStatus.HIRED, artemisTrainingCompleted: false },
  })

  const upcomingCount = await prisma.trainingSession.count({
    where: { status: 'SCHEDULED', startTime: { gt: now } },
  })

  const activity = recentBookings.map((b) => ({
    type: 'booking' as const,
    at: b.bookedAt,
    label: `${b.rbtProfile.firstName} ${b.rbtProfile.lastName} booked ${b.trainingSession.title}`,
  }))

  return NextResponse.json({
    stats: {
      upcomingSessions: upcomingCount,
      rbtsTrained: trainedCount,
      awaitingTraining: awaitingCount,
      thisMonthSessions: monthSessions,
    },
    upcomingSessions,
    awaitingProfiles,
    activity,
  })
}
