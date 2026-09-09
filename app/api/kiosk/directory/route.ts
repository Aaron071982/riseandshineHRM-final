import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertRateLimit } from '@/lib/otp-rate-limit'
import { requireKioskDevice } from '@/lib/kiosk/auth'
import {
  easternDayOfWeek,
  easternTodayDateUtc,
  easternTodayRangeUtc,
} from '@/lib/kiosk/today'

export const dynamic = 'force-dynamic'

type TodaySession = {
  scheduleAssignmentId: string
  startTime: string
  endTime: string
  btName: string
  location: string | null
} | null

export async function GET(request: NextRequest) {
  const auth = await requireKioskDevice(request)
  if (auth.response) return auth.response
  const { device } = auth

  const limited = await assertRateLimit(
    `kiosk:directory:device:${device.id}`,
    60,
    15 * 60 * 1000
  )
  if (limited) return limited

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const dow = easternDayOfWeek()
  const todayDate = easternTodayDateUtc()
  const { start: dayStart, end: dayEnd } = easternTodayRangeUtc()

  const where: Prisma.ServiceClientWhereInput = {
    isCenterClient: true,
    pipelineStatus: 'LIVE',
    deletedAt: null,
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { parentName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const clients = await prisma.serviceClient.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentRelationship: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: 25,
  })

  const results = await Promise.all(
    clients.map(async (c) => {
      const [session, outstandingForms, latestEvent] = await Promise.all([
        prisma.rbtScheduleAssignment.findFirst({
          where: {
            serviceClientId: c.id,
            dayOfWeek: dow,
            isActive: true,
            deletedAt: null,
            AND: [
              {
                OR: [
                  { periodStart: null },
                  { periodStart: { lte: todayDate } },
                ],
              },
              {
                OR: [{ periodEnd: null }, { periodEnd: { gte: todayDate } }],
              },
            ],
          },
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            location: true,
            rbtProfile: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
        prisma.clientRequirement.count({
          where: {
            serviceClientId: c.id,
            deletedAt: null,
            completedAt: null,
            attestedAt: null,
          },
        }),
        prisma.clientAttendanceEvent.findFirst({
          where: {
            serviceClientId: c.id,
            voidedAt: null,
            eventAt: { gte: dayStart, lt: dayEnd },
          },
          orderBy: { eventAt: 'desc' },
          select: { eventType: true },
        }),
      ])

      const todaySession: TodaySession = session
        ? {
            scheduleAssignmentId: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            btName: `${session.rbtProfile.firstName} ${session.rbtProfile.lastName}`.trim(),
            location: session.location,
          }
        : null

      const currentStatus: 'in' | 'out' =
        latestEvent?.eventType === 'IN' ? 'in' : 'out'

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        parentName: c.parentName,
        parentRelationship: c.parentRelationship,
        outstandingForms,
        currentStatus,
        todaySession,
      }
    })
  )

  return NextResponse.json(results)
}
