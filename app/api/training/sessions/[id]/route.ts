import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email/core'
import { generateArtemisSessionCancelledEmail } from '@/lib/email/generators'
import { logTrainingEmail, trainingPortalUrl } from '@/lib/training/notifications'
import { TrainingEmailType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id } = await context.params
  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: { host: { select: { id: true, name: true, email: true } } },
  })
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ session })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string') data.title = body.title.trim()
    if (typeof body.description === 'string') data.description = body.description
    if (typeof body.meetingUrl === 'string') data.meetingUrl = body.meetingUrl.trim()
    if (typeof body.notes === 'string') data.notes = body.notes
    if (typeof body.sessionDate === 'string') data.sessionDate = new Date(body.sessionDate + 'T12:00:00.000Z')
    if (typeof body.startTime === 'string') data.startTime = new Date(body.startTime)
    if (typeof body.endTime === 'string') data.endTime = new Date(body.endTime)
    if (body.maxAttendees != null) {
      const n = parseInt(String(body.maxAttendees), 10)
      if (!Number.isNaN(n)) data.maxAttendees = Math.min(50, Math.max(1, n))
    }
    if (typeof body.status === 'string') {
      const s = body.status.toUpperCase()
      if (['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(s)) {
        data.status = s
      }
    }

    const session = await prisma.trainingSession.update({
      where: { id },
      data,
    })
    return NextResponse.json({ session })
  } catch (e) {
    console.error('[PATCH training session]', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason : null

    const session = await prisma.trainingSession.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { attendanceStatus: { in: ['BOOKED'] } },
          include: { rbtProfile: { select: { id: true, firstName: true, email: true } } },
        },
      },
    })
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const now = new Date()
    const upcoming = await prisma.trainingSession.findMany({
      where: {
        id: { not: id },
        status: 'SCHEDULED',
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    })

    const portal = trainingPortalUrl()
    const altHtml =
      upcoming.length === 0
        ? '<p>No other sessions are open yet — check back soon.</p>'
        : `<ul>${upcoming
            .map(
              (s) =>
                `<li><strong>${s.title}</strong> — ${s.startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} · <a href="${portal}">Book</a></li>`
            )
            .join('')}</ul>`

    for (const b of session.bookings) {
      const em = b.rbtProfile.email
      if (!em) continue
      const { subject, html } = generateArtemisSessionCancelledEmail({
        firstName: b.rbtProfile.firstName,
        sessionTitle: session.title,
        sessionDate: session.startTime.toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
        reason,
        alternativesHtml: altHtml,
        portalUrl: portal,
      })
      await sendGenericEmail(em, subject, html)
      await logTrainingEmail({
        trainingSessionId: id,
        rbtProfileId: b.rbtProfile.id,
        emailType: 'SESSION_CANCELLED' as TrainingEmailType,
      })
    }

    await prisma.trainingBooking.updateMany({
      where: { trainingSessionId: id, attendanceStatus: 'BOOKED' },
      data: { attendanceStatus: 'CANCELLED' },
    })

    await prisma.trainingSession.update({
      where: { id },
      data: { status: 'CANCELLED', currentAttendees: 0 },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE training session]', e)
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}
