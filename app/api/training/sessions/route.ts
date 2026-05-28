import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TrainingSessionStatus } from '@prisma/client'
import { sendNewSessionAvailableBlast } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const sp = request.nextUrl.searchParams
  const filter = sp.get('filter') || 'all' // upcoming | past | all | cancelled

  const now = new Date()
  let where: Record<string, unknown> = {}

  if (filter === 'upcoming') {
    where = { status: { not: 'CANCELLED' }, endTime: { gte: now } }
  } else if (filter === 'past') {
    where = { endTime: { lt: now }, status: { not: 'CANCELLED' } }
  } else if (filter === 'cancelled') {
    where = { status: 'CANCELLED' as TrainingSessionStatus }
  } else {
    where = {}
  }

  const sessions = await prisma.trainingSession.findMany({
    where,
    include: { host: { select: { id: true, name: true, email: true } } },
    orderBy: filter === 'past' ? { startTime: 'desc' } : { startTime: 'asc' },
  })

  return NextResponse.json({ sessions })
}

export async function POST(request: NextRequest) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Artemis Training'
    const description = typeof body.description === 'string' ? body.description : null
    const meetingUrl = typeof body.meetingUrl === 'string' ? body.meetingUrl.trim() : ''
    if (!meetingUrl) {
      return NextResponse.json({ error: 'meetingUrl is required' }, { status: 400 })
    }
    const sessionDateStr = typeof body.sessionDate === 'string' ? body.sessionDate : ''
    const startTimeStr = typeof body.startTime === 'string' ? body.startTime : ''
    const endTimeStr = typeof body.endTime === 'string' ? body.endTime : ''
    if (!sessionDateStr || !startTimeStr || !endTimeStr) {
      return NextResponse.json({ error: 'sessionDate, startTime, and endTime are required' }, { status: 400 })
    }
    const startTime = new Date(startTimeStr)
    const endTime = new Date(endTimeStr)
    const sessionDate = new Date(sessionDateStr + 'T12:00:00.000Z')
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 })
    }
    const maxAttendees = Math.min(50, Math.max(1, parseInt(String(body.maxAttendees ?? 10), 10) || 10))
    const notes = typeof body.notes === 'string' ? body.notes : null
    const notify = Boolean(body.notify)

    const session = await prisma.trainingSession.create({
      data: {
        hostUserId: auth.user.id,
        title,
        description,
        sessionDate,
        startTime,
        endTime,
        meetingUrl,
        maxAttendees,
        currentAttendees: 0,
        status: 'SCHEDULED',
        notes,
      },
    })

    if (notify) {
      try {
        const { sent } = await sendNewSessionAvailableBlast(session.id)
        return NextResponse.json({ session, notifySent: sent })
      } catch (e) {
        console.error('[POST training/sessions notify]', e)
        return NextResponse.json({ session, notifySent: 0, notifyError: String(e) })
      }
    }

    return NextResponse.json({ session })
  } catch (e) {
    console.error('[POST training/sessions]', e)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
