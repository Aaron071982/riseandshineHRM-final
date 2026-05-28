import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, RBTStatus } from '@prisma/client'
import { sendBookingConfirmationToRbt, notifyTrainerNewBooking } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rbtId: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const { rbtId: rbtProfileId } = await context.params
  const body = await request.json().catch(() => ({}))
  const sessionId = typeof body.trainingSessionId === 'string' ? body.trainingSessionId.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ error: 'trainingSessionId required' }, { status: 400 })
  }

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { status: true, artemisTrainingCompleted: true, firstName: true, lastName: true },
  })
  if (!profile || profile.status !== RBTStatus.HIRED) {
    return NextResponse.json({ error: 'RBT must be hired' }, { status: 400 })
  }
  if (profile.artemisTrainingCompleted) {
    return NextResponse.json({ error: 'Already trained' }, { status: 400 })
  }

  try {
    await prisma.$transaction(
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

        const session = await tx.trainingSession.findUnique({ where: { id: sessionId } })
        if (!session || session.status !== 'SCHEDULED') {
          throw Object.assign(new Error('Bad session'), { code: 'BAD_SESSION' })
        }
        if (session.startTime <= now) {
          throw Object.assign(new Error('Started'), { code: 'STARTED' })
        }
        if (session.currentAttendees >= session.maxAttendees) {
          throw Object.assign(new Error('Full'), { code: 'FULL' })
        }

        const dup = await tx.trainingBooking.findUnique({
          where: {
            trainingSessionId_rbtProfileId: { trainingSessionId: sessionId, rbtProfileId },
          },
        })
        if (dup?.attendanceStatus === 'BOOKED') {
          throw Object.assign(new Error('Dup'), { code: 'DUPLICATE' })
        }
        if (dup?.attendanceStatus === 'ATTENDED') {
          throw Object.assign(new Error('Attended'), { code: 'ATTENDED' })
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
          throw Object.assign(new Error('Seat'), { code: 'SEAT_RACE' })
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    )

    const fullProfile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { id: true, firstName: true, email: true, lastName: true },
    })
    const fullSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
    if (fullProfile && fullSession) {
      await sendBookingConfirmationToRbt({ rbtProfile: fullProfile, session: fullSession })
      await notifyTrainerNewBooking({
        hostUserId: fullSession.hostUserId,
        rbtName: `${fullProfile.firstName} ${fullProfile.lastName}`,
        sessionTitle: fullSession.title,
        startTime: fullSession.startTime,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err.code === 'FULL' || err.code === 'SEAT_RACE') {
      return NextResponse.json({ error: 'Session full' }, { status: 409 })
    }
    if (err.code === 'ALREADY_BOOKED' || err.code === 'DUPLICATE') {
      return NextResponse.json({ error: 'Already has booking' }, { status: 409 })
    }
    console.error('[trainee book]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
