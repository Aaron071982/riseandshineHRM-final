import type { Prisma, TrainingBookingAttendanceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth'
import { syncTierMilestones } from '@/lib/onboarding/progress'

export async function applyTrainingAttendanceEffects(params: {
  bookingId: string
  attendanceStatus: TrainingBookingAttendanceStatus
  actorUser: SessionUser
}): Promise<void> {
  const { bookingId, attendanceStatus, actorUser } = params

  if (attendanceStatus !== 'ATTENDED') {
    await prisma.trainingBooking.update({
      where: { id: bookingId },
      data: {
        attendanceStatus,
        markedAttendedBy: actorUser.id,
        markedAttendedAt: new Date(),
      },
    })
    return
  }

  const booking = await prisma.trainingBooking.findUnique({
    where: { id: bookingId },
    include: { trainingSession: true, rbtProfile: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!booking) throw new Error('Booking not found')
  if (booking.attendanceStatus === 'ATTENDED') return

  const session = booking.trainingSession
  const now = new Date()

  await prisma.$transaction([
    prisma.trainingBooking.update({
      where: { id: bookingId },
      data: {
        attendanceStatus: 'ATTENDED',
        markedAttendedBy: actorUser.id,
        markedAttendedAt: now,
      },
    }),
    prisma.rBTProfile.update({
      where: { id: booking.rbtProfileId },
      data: {
        artemisTrainingCompleted: true,
        artemisTrainingCompletedAt: now,
        artemisTrainingSessionId: session.id,
      },
    }),
  ])

  const metadata: Prisma.JsonObject = {
    kind: 'ARTEMIS_TRAINING_COMPLETED',
    trainingSessionId: session.id,
    rbtProfileId: booking.rbtProfileId,
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId: actorUser.id,
        activityType: 'FORM_SUBMISSION',
        action: 'Artemis training marked complete',
        resourceType: 'training_booking',
        resourceId: bookingId,
        metadata,
      },
    })
  } catch {
    // non-fatal
  }

  try {
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: booking.rbtProfileId,
        auditType: 'ARTEMIS_TRAINING',
        dateTime: now,
        notes: `Completed Artemis Training (session ${session.title} on ${session.sessionDate.toISOString().slice(0, 10)})`,
        createdBy: actorUser.email || actorUser.name || 'Trainer',
      },
    })
  } catch {
    // non-fatal
  }

  const artemisDoc = await prisma.onboardingDocument.findFirst({
    where: { slug: 'artemis-training', isActive: true },
  })
  if (artemisDoc) {
    await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: {
          rbtProfileId: booking.rbtProfileId,
          documentId: artemisDoc.id,
        },
      },
      create: {
        rbtProfileId: booking.rbtProfileId,
        documentId: artemisDoc.id,
        status: 'COMPLETED',
        completedAt: now,
      },
      update: { status: 'COMPLETED', completedAt: now },
    })
  }
  await syncTierMilestones(booking.rbtProfileId)
}

/** Super-admin override: mark Artemis complete without a booking/session. */
export async function completeArtemisTrainingWithoutSession(params: {
  rbtProfileId: string
  actorUser: SessionUser
}): Promise<void> {
  const { rbtProfileId, actorUser } = params
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { artemisTrainingCompleted: true },
  })
  if (!profile) throw new Error('RBT not found')
  if (profile.artemisTrainingCompleted) return

  const now = new Date()

  await prisma.rBTProfile.update({
    where: { id: rbtProfileId },
    data: {
      artemisTrainingCompleted: true,
      artemisTrainingCompletedAt: now,
    },
  })

  const metadata: Prisma.JsonObject = {
    kind: 'ARTEMIS_TRAINING_COMPLETED',
    override: true,
    rbtProfileId,
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId: actorUser.id,
        activityType: 'FORM_SUBMISSION',
        action: 'Artemis training marked complete (override)',
        resourceType: 'rbt_profile',
        resourceId: rbtProfileId,
        metadata,
      },
    })
  } catch {
    // non-fatal
  }

  try {
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId,
        auditType: 'ARTEMIS_TRAINING',
        dateTime: now,
        notes: 'Completed Artemis Training (admin override)',
        createdBy: actorUser.email || actorUser.name || 'Admin',
      },
    })
  } catch {
    // non-fatal
  }

  const artemisDoc = await prisma.onboardingDocument.findFirst({
    where: { slug: 'artemis-training', isActive: true },
  })
  if (artemisDoc) {
    await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: {
          rbtProfileId,
          documentId: artemisDoc.id,
        },
      },
      create: {
        rbtProfileId,
        documentId: artemisDoc.id,
        status: 'COMPLETED',
        completedAt: now,
      },
      update: { status: 'COMPLETED', completedAt: now },
    })
  }
  await syncTierMilestones(rbtProfileId)
}

