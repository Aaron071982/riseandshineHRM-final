import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { easternToUTC, getEasternDate } from '@/lib/eastern-time'

export const dynamic = 'force-dynamic'

function encodeSlotId(interviewerId: string, startTime: Date): string {
  return `${interviewerId}_${startTime.toISOString()}`
}

function toDateKey(easternYMD: { year: number; month: number; day: number }): string {
  return `${easternYMD.year}-${String(easternYMD.month).padStart(2, '0')}-${String(easternYMD.day).padStart(2, '0')}`
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const interviewerId = searchParams.get('interviewerId') || undefined
    const daysAhead = Math.min(30, Math.max(1, parseInt(searchParams.get('daysAhead') || '30', 10)))

    const now = new Date()

    const interviewers = await prisma.user.findMany({
      where: {
        ...(interviewerId ? { id: interviewerId } : {}),
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
        interviewerSettings: { select: { slotDurationMinutes: true, bufferMinutes: true } },
        interviewerAvailability: {
          where: { isActive: true },
          select: {
            dayOfWeek: true,
            startHour: true,
            startMinute: true,
            endHour: true,
            endMinute: true,
          },
        },
      },
    })

    if (interviewers.length === 0) {
      return NextResponse.json({})
    }

    const interviewerIds = interviewers.map((u) => u.id)

    const todayEasternYMD = getEasternDate(now)
    const rangeStartUTC = easternToUTC(todayEasternYMD.year, todayEasternYMD.month, todayEasternYMD.day, 0, 0)
    const rangeEndUTCExclusive = easternToUTC(todayEasternYMD.year, todayEasternYMD.month, todayEasternYMD.day + daysAhead, 0, 0)

    const bookedInterviews = await prisma.interview.findMany({
      where: {
        claimedByUserId: { in: interviewerIds },
        status: 'SCHEDULED',
        scheduledAt: { gte: rangeStartUTC, lt: rangeEndUTCExclusive },
      },
      select: {
        claimedByUserId: true,
        scheduledAt: true,
        durationMinutes: true,
      },
    })

    const bookedByInterviewer: Record<string, Array<{ start: Date; end: Date }>> = {}
    for (const interview of bookedInterviews) {
      if (!interview.claimedByUserId) continue
      const start = new Date(interview.scheduledAt)
      const durationMinutes = interview.durationMinutes ?? 15
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

      if (!bookedByInterviewer[interview.claimedByUserId]) bookedByInterviewer[interview.claimedByUserId] = []
      bookedByInterviewer[interview.claimedByUserId].push({ start, end })
    }

    const slotsByDate: Record<
      string,
      Array<{
        slotId: string
        interviewerId: string
        interviewerName: string
        startTime: string
        endTime: string
        isBooked: boolean
      }>
    > = {}

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const easternMiddayUTC = easternToUTC(
        todayEasternYMD.year,
        todayEasternYMD.month,
        todayEasternYMD.day + dayOffset,
        12,
        0
      )
      const easternYMD = getEasternDate(easternMiddayUTC)
      const dayOfWeek = easternMiddayUTC.getUTCDay() // 0=Sunday..6=Saturday
      const dateKey = toDateKey(easternYMD)

      for (const interviewer of interviewers) {
        const durationMinutes = interviewer.interviewerSettings?.slotDurationMinutes ?? 15
        const bufferMinutes = interviewer.interviewerSettings?.bufferMinutes ?? 0
        const firstName = (interviewer.name || 'Interviewer').split(/\\s+/)[0]
        const interviewerBooked = bookedByInterviewer[interviewer.id] ?? []

        for (const availability of interviewer.interviewerAvailability) {
          if (availability.dayOfWeek !== dayOfWeek) continue

          const availabilityStartLocal = availability.startHour * 60 + availability.startMinute
          const availabilityEndLocal = availability.endHour * 60 + availability.endMinute
          const stepMinutes = durationMinutes + bufferMinutes

          for (
            let slotStartLocalMinutes = availabilityStartLocal;
            slotStartLocalMinutes + durationMinutes <= availabilityEndLocal;
            slotStartLocalMinutes += stepMinutes
          ) {
            const slotStartHour = Math.floor(slotStartLocalMinutes / 60)
            const slotStartMinute = slotStartLocalMinutes % 60

            const slotStartUTC = easternToUTC(
              easternYMD.year,
              easternYMD.month,
              easternYMD.day,
              slotStartHour,
              slotStartMinute
            )

            if (slotStartUTC < now) continue

            const slotEndUTC = new Date(slotStartUTC.getTime() + durationMinutes * 60 * 1000)

            const isBooked = interviewerBooked.some((interval) =>
              intervalsOverlap(interval.start, interval.end, slotStartUTC, slotEndUTC)
            )

            const slotId = encodeSlotId(interviewer.id, slotStartUTC)
            if (!slotsByDate[dateKey]) slotsByDate[dateKey] = []
            slotsByDate[dateKey].push({
              slotId,
              interviewerId: interviewer.id,
              interviewerName: firstName,
              startTime: slotStartUTC.toISOString(),
              endTime: slotEndUTC.toISOString(),
              isBooked,
            })
          }
        }
      }
    }

    for (const slots of Object.values(slotsByDate)) {
      slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }

    return NextResponse.json(slotsByDate)
  } catch (error) {
    console.error('GET /api/public/interviewer-slots', error)
    return NextResponse.json({ error: 'Failed to load slots' }, { status: 500 })
  }
}
