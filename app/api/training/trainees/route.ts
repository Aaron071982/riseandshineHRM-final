import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RBTStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const sp = request.nextUrl.searchParams
  const filter = sp.get('filter') || 'all'
  const q = (sp.get('q') || '').trim().toLowerCase()

  const now = new Date()

  const profiles = await prisma.rBTProfile.findMany({
    where: {
      status: RBTStatus.HIRED,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      artemisTrainingCompleted: true,
      artemisTrainingCompletedAt: true,
      artemisTrainingSessionId: true,
    },
    orderBy: { updatedAt: 'asc' },
  })

  const ids = profiles.map((p) => p.id)
  const bookings = await prisma.trainingBooking.findMany({
    where: {
      rbtProfileId: { in: ids },
      attendanceStatus: 'BOOKED',
      trainingSession: { endTime: { gt: now } },
    },
    include: {
      trainingSession: { select: { id: true, title: true, startTime: true, endTime: true } },
    },
  })
  const bookingByRbt = new Map(bookings.map((b) => [b.rbtProfileId, b]))

  const lastEmailRows = await prisma.trainingEmailLog.findMany({
    where: { rbtProfileId: { in: ids } },
    orderBy: { sentAt: 'desc' },
    select: { rbtProfileId: true, sentAt: true, emailType: true },
  })
  const lastEmailMap = new Map<string, { sentAt: Date; emailType: string }>()
  for (const row of lastEmailRows) {
    if (!lastEmailMap.has(row.rbtProfileId)) {
      lastEmailMap.set(row.rbtProfileId, { sentAt: row.sentAt, emailType: row.emailType })
    }
  }

  let rows = profiles.map((p) => {
    const book = bookingByRbt.get(p.id)
    const lastEm = lastEmailMap.get(p.id)
    const trained = p.artemisTrainingCompleted
    const bookedPending = !!book && !trained
    return {
      ...p,
      activeBooking: book
        ? {
            id: book.id,
            sessionId: book.trainingSessionId,
            sessionStart: book.trainingSession.startTime,
            sessionEnd: book.trainingSession.endTime,
            sessionTitle: book.trainingSession.title,
          }
        : null,
      lastEmailSentAt: lastEm?.sentAt ?? null,
      lastEmailType: lastEm?.emailType ?? null,
      hireProxyAt: p.updatedAt,
    }
  })

  if (filter === 'trained') {
    rows = rows.filter((r) => r.artemisTrainingCompleted)
  } else if (filter === 'not_trained') {
    rows = rows.filter((r) => !r.artemisTrainingCompleted && !r.activeBooking)
  } else if (filter === 'booked') {
    rows = rows.filter((r) => !!r.activeBooking && !r.artemisTrainingCompleted)
  }

  return NextResponse.json({ trainees: rows })
}
