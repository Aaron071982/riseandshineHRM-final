import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response

  const now = new Date()
  const sessions = await prisma.trainingSession.findMany({
    where: {
      status: 'SCHEDULED',
      startTime: { gt: now },
    },
    include: { host: { select: { name: true } } },
    orderBy: { startTime: 'asc' },
  })

  const list = sessions
    .map((s) => {
      const seatsLeft = Math.max(0, s.maxAttendees - s.currentAttendees)
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        meetingUrl: s.meetingUrl,
        maxAttendees: s.maxAttendees,
        currentAttendees: s.currentAttendees,
        seatsLeft,
        hostName: s.host.name,
      }
    })
    .filter((s) => s.seatsLeft > 0)

  return NextResponse.json({ sessions: list })
}
