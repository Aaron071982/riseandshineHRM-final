import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TrainingBookingAttendanceStatus } from '@prisma/client'
import { applyTrainingAttendanceEffects } from '@/lib/training/attendance'
import { sendCompletionEmailToRbt } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response
  const { id: bookingId } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const attendanceStatus = body.attendanceStatus as TrainingBookingAttendanceStatus
    const allowed: TrainingBookingAttendanceStatus[] = ['BOOKED', 'ATTENDED', 'NO_SHOW', 'CANCELLED']
    if (!allowed.includes(attendanceStatus)) {
      return NextResponse.json({ error: 'Invalid attendanceStatus' }, { status: 400 })
    }

    const before = await prisma.trainingBooking.findUnique({
      where: { id: bookingId },
      include: { trainingSession: true },
    })
    if (!before) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await applyTrainingAttendanceEffects({
      bookingId,
      attendanceStatus,
      actorUser: auth.user,
    })

    if (attendanceStatus === 'ATTENDED') {
      const host = await prisma.user.findUnique({
        where: { id: before.trainingSession.hostUserId },
        select: { name: true },
      })
      const rp = await prisma.rBTProfile.findUnique({
        where: { id: before.rbtProfileId },
        select: { id: true, firstName: true, email: true },
      })
      if (rp) {
        await sendCompletionEmailToRbt({
          trainingSessionId: before.trainingSessionId,
          rbtProfile: rp,
          completedAt: new Date(),
          trainerName: host?.name ?? null,
        })
      }
    }

    const booking = await prisma.trainingBooking.findUnique({ where: { id: bookingId } })
    return NextResponse.json({ booking })
  } catch (e) {
    console.error('[PATCH booking attendance]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
