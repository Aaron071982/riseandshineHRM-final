import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sendBookingConfirmationToRbt, notifyTrainerNewBooking } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const sessionId = typeof body.trainingSessionId === 'string' ? body.trainingSessionId.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ error: 'trainingSessionId required' }, { status: 400 })
  }

  const rbtProfileId = auth.user.rbtProfileId!

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { status: true, artemisTrainingCompleted: true },
  })
  if (!profile || profile.status !== 'HIRED') {
    return NextResponse.json({ error: 'Must be a hired RBT' }, { status: 403 })
  }
  if (profile.artemisTrainingCompleted) {
    return NextResponse.json({ error: 'Training already completed' }, { status: 400 })
  }

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const now = new Date()
        const existingFuture = await tx.trainingBooking.findFirst({
          where: {
            rbtProfileId,
            attendanceStatus: 'BOOKED',
            trainingSession: {
              endTime: { gt: now },
              status: 'SCHEDULED',
            },
          },
        })
        if (existingFuture) {
          throw Object.assign(new Error('Already booked'), { code: 'ALREADY_BOOKED' })
        }

        const session = await tx.trainingSession.findUnique({
          where: { id: sessionId },
        })
        if (!session || session.status !== 'SCHEDULED') {
          throw Object.assign(new Error('Session not available'), { code: 'BAD_SESSION' })
        }
        if (session.startTime <= now) {
          throw Object.assign(new Error('Session already started'), { code: 'STARTED' })
        }
        if (session.currentAttendees >= session.maxAttendees) {
          throw Object.assign(new Error('Session full'), { code: 'FULL' })
        }

        const dup = await tx.trainingBooking.findUnique({
          where: {
            trainingSessionId_rbtProfileId: {
              trainingSessionId: sessionId,
              rbtProfileId,
            },
          },
        })
        if (dup?.attendanceStatus === 'BOOKED') {
          throw Object.assign(new Error('Already booked this session'), { code: 'DUPLICATE' })
        }
        if (dup?.attendanceStatus === 'ATTENDED') {
          throw Object.assign(new Error('Already attended'), { code: 'ATTENDED' })
        }

        if (!dup) {
          await tx.trainingBooking.create({
            data: {
              trainingSessionId: sessionId,
              rbtProfileId,
              attendanceStatus: 'BOOKED',
            },
          })
        } else {
          await tx.trainingBooking.update({
            where: { id: dup.id },
            data: { attendanceStatus: 'BOOKED', bookedAt: new Date() },
          })
        }

        const updated = await tx.trainingSession.updateMany({
          where: {
            id: sessionId,
            currentAttendees: { lt: session.maxAttendees },
          },
          data: { currentAttendees: { increment: 1 } },
        })
        if (updated.count !== 1) {
          throw Object.assign(new Error('Could not reserve seat'), { code: 'SEAT_RACE' })
        }

        const b = await tx.trainingBooking.findUnique({
          where: {
            trainingSessionId_rbtProfileId: { trainingSessionId: sessionId, rbtProfileId },
          },
        })
        if (!b) throw new Error('booking missing')
        return { booking: b, session }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    )

    const fullProfile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const fullSession = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
    })

    if (fullProfile && fullSession) {
      await sendBookingConfirmationToRbt({ rbtProfile: fullProfile, session: fullSession })
      await notifyTrainerNewBooking({
        hostUserId: fullSession.hostUserId,
        rbtName: `${fullProfile.firstName} ${fullProfile.lastName}`,
        sessionTitle: fullSession.title,
        startTime: fullSession.startTime,
      })
    }

    return NextResponse.json({ bookingId: booking.booking.id })
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err.code === 'ALREADY_BOOKED') {
      return NextResponse.json({ error: 'You already have an upcoming booking' }, { status: 409 })
    }
    if (err.code === 'FULL' || err.code === 'SEAT_RACE') {
      return NextResponse.json({ error: 'This session is full. Try another time.' }, { status: 409 })
    }
    if (err.code === 'DUPLICATE') {
      return NextResponse.json({ error: 'Already booked for this session' }, { status: 409 })
    }
    if (err.code === 'ATTENDED') {
      return NextResponse.json({ error: 'Already completed this session' }, { status: 409 })
    }
    if (err.code === 'BAD_SESSION' || err.code === 'STARTED') {
      return NextResponse.json({ error: err.message ?? 'Session not available' }, { status: 400 })
    }
    console.error('[rbt/training/book]', e)
    return NextResponse.json({ error: 'Booking failed' }, { status: 500 })
  }
}
