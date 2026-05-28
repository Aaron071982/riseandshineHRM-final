import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response

  const rbtProfileId = auth.user.rbtProfileId!
  const now = new Date()

  const booking = await prisma.trainingBooking.findFirst({
    where: {
      rbtProfileId,
      attendanceStatus: 'BOOKED',
      trainingSession: { status: 'SCHEDULED' },
    },
    include: { trainingSession: true },
  })

  if (!booking) {
    return NextResponse.json({ error: 'No active booking' }, { status: 404 })
  }

  const cutoff = new Date(booking.trainingSession.startTime.getTime() - 2 * 60 * 60 * 1000)
  if (now > cutoff) {
    return NextResponse.json(
      { error: 'Cancellation must be at least 2 hours before the session' },
      { status: 400 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.trainingBooking.update({
      where: { id: booking.id },
      data: { attendanceStatus: 'CANCELLED' },
    })
    const sess = await tx.trainingSession.findUnique({
      where: { id: booking.trainingSessionId },
      select: { currentAttendees: true },
    })
    if (sess && sess.currentAttendees > 0) {
      await tx.trainingSession.update({
        where: { id: booking.trainingSessionId },
        data: { currentAttendees: sess.currentAttendees - 1 },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
