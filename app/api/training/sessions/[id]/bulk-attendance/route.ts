import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TrainingBookingAttendanceStatus } from '@prisma/client'
import { applyTrainingAttendanceEffects } from '@/lib/training/attendance'
import { sendCompletionEmailToRbt } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id: sessionId } = await context.params

  const body = await request.json().catch(() => ({}))
  const bookingIds = Array.isArray(body.bookingIds) ? body.bookingIds.filter((x: unknown) => typeof x === 'string') : []
  const attendanceStatus = body.attendanceStatus as TrainingBookingAttendanceStatus
  if (!bookingIds.length) {
    return NextResponse.json({ error: 'bookingIds required' }, { status: 400 })
  }
  if (attendanceStatus !== 'ATTENDED' && attendanceStatus !== 'NO_SHOW' && attendanceStatus !== 'CANCELLED') {
    return NextResponse.json({ error: 'Invalid attendanceStatus' }, { status: 400 })
  }

  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  let processed = 0
  for (const bookingId of bookingIds) {
    const booking = await prisma.trainingBooking.findFirst({
      where: { id: bookingId, trainingSessionId: sessionId },
    })
    if (!booking) continue

    await applyTrainingAttendanceEffects({
      bookingId,
      attendanceStatus,
      actorUser: auth.user,
    })

    if (attendanceStatus === 'ATTENDED') {
      const host = await prisma.user.findUnique({
        where: { id: session.hostUserId },
        select: { name: true },
      })
      const rp = await prisma.rBTProfile.findUnique({
        where: { id: booking.rbtProfileId },
        select: { id: true, firstName: true, email: true },
      })
      if (rp) {
        await sendCompletionEmailToRbt({
          trainingSessionId: sessionId,
          rbtProfile: rp,
          completedAt: new Date(),
          trainerName: host?.name ?? null,
        })
      }
    }
    processed++
  }

  return NextResponse.json({ processed })
}
