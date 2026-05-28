import { TrainingEmailType, RBTStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { makePublicUrl } from '@/lib/baseUrl'
import { sendGenericEmail } from '@/lib/email/core'
import {
  generateArtemisBookingConfirmationEmail,
  generateArtemisCompletionEmail,
  generateArtemisNewSessionEmail,
} from '@/lib/email/generators'
import { buildArtemisTrainingIcs } from '@/lib/training/ics'
import type { TrainingSession } from '@prisma/client'

export async function logTrainingEmail(input: {
  trainingSessionId: string
  rbtProfileId: string
  emailType: TrainingEmailType
}): Promise<void> {
  await prisma.trainingEmailLog.create({
    data: {
      trainingSessionId: input.trainingSessionId,
      rbtProfileId: input.rbtProfileId,
      emailType: input.emailType,
    },
  })
}

export function trainingPortalUrl(): string {
  return makePublicUrl('/rbt/training')
}

/** Eligible for Artemis marketing emails: hired RBTs who have not completed training. */
export async function eligibleUntrainedProfiles() {
  return prisma.rBTProfile.findMany({
    where: {
      status: RBTStatus.HIRED,
      artemisTrainingCompleted: false,
      email: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      email: true,
    },
  })
}

export async function sendNewSessionAvailableBlast(featuredSessionId: string): Promise<{ sent: number }> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: featuredSessionId },
  })
  if (!session) throw new Error('Session not found')

  const now = new Date()
  const upcoming = await prisma.trainingSession.findMany({
    where: {
      status: 'SCHEDULED',
      startTime: { gt: now },
    },
    orderBy: { startTime: 'asc' },
  })

  const profiles = await eligibleUntrainedProfiles()
  const bookUrl = trainingPortalUrl()
  let sent = 0

  for (const p of profiles) {
    if (!p.email) continue
    const seatsLeft = Math.max(0, session.maxAttendees - session.currentAttendees)
    const otherSessions = upcoming
      .filter((s) => s.id !== session.id)
      .slice(0, 5)
      .map((s) => ({
        title: s.title,
        whenLine: `${s.startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
        bookingUrl: bookUrl,
      }))
    const { subject, html } = generateArtemisNewSessionEmail({
      firstName: p.firstName,
      featuredSession: {
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
        seatsLeft,
        maxAttendees: session.maxAttendees,
        bookingUrl: bookUrl,
      },
      otherSessions,
    })
    await sendGenericEmail(p.email, subject, html)
    await logTrainingEmail({
      trainingSessionId: session.id,
      rbtProfileId: p.id,
      emailType: 'NEW_SESSION_AVAILABLE',
    })
    sent++
  }
  return { sent }
}

export async function notifyTrainerNewBooking(params: {
  hostUserId: string
  rbtName: string
  sessionTitle: string
  startTime: Date
}): Promise<void> {
  const host = await prisma.user.findUnique({
    where: { id: params.hostUserId },
    select: { email: true },
  })
  if (!host?.email) return
  const when = params.startTime.toLocaleString('en-US', { timeZone: 'America/New_York' })
  await sendGenericEmail(
    host.email,
    `Artemis booking: ${params.rbtName}`,
    `<p><strong>${params.rbtName}</strong> booked <strong>${params.sessionTitle}</strong>.</p><p>${when}</p>`
  )
  try {
    await prisma.adminNotification.create({
      data: {
        userId: params.hostUserId,
        type: 'ARTEMIS_BOOKING',
        message: `${params.rbtName} booked ${params.sessionTitle}`,
        linkUrl: '/training/sessions',
      },
    })
  } catch {
    // ignore
  }
}

export async function sendBookingConfirmationToRbt(params: {
  rbtProfile: { id: string; firstName: string; email: string | null }
  session: TrainingSession
}): Promise<void> {
  const email = params.rbtProfile.email
  if (!email) return

  const portalUrl = trainingPortalUrl()
  const { subject, html } = generateArtemisBookingConfirmationEmail({
    firstName: params.rbtProfile.firstName,
    sessionTitle: params.session.title,
    startTime: params.session.startTime,
    endTime: params.session.endTime,
    meetingUrl: params.session.meetingUrl,
    portalTrainingUrl: portalUrl,
  })

  const ics = buildArtemisTrainingIcs({
    uid: `${params.session.id}-${params.rbtProfile.id}@riseandshine.nyc`,
    start: params.session.startTime,
    end: params.session.endTime,
    summary: params.session.title,
    description: `Artemis Training — Join: ${params.session.meetingUrl}`,
    location: params.session.meetingUrl,
  })
  const icsB64 = Buffer.from(ics, 'utf8').toString('base64')

  await sendGenericEmail(email, subject, html, [
    { filename: 'artemis-training.ics', content: icsB64 },
  ])
  await logTrainingEmail({
    trainingSessionId: params.session.id,
    rbtProfileId: params.rbtProfile.id,
    emailType: 'BOOKING_CONFIRMATION',
  })
}

export async function sendCompletionEmailToRbt(params: {
  trainingSessionId: string
  rbtProfile: { id: string; firstName: string; email: string | null }
  completedAt: Date
  trainerName: string | null
}): Promise<void> {
  const email = params.rbtProfile.email
  if (!email) return
  const { subject, html } = generateArtemisCompletionEmail({
    firstName: params.rbtProfile.firstName,
    completedAt: params.completedAt,
    trainerName: params.trainerName,
    profileUrl: makePublicUrl('/rbt/dashboard'),
  })
  await sendGenericEmail(email, subject, html)
  await logTrainingEmail({
    trainingSessionId: params.trainingSessionId,
    rbtProfileId: params.rbtProfile.id,
    emailType: 'COMPLETION',
  })
}
