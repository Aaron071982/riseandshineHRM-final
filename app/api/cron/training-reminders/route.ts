import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCronOrResponse } from '@/lib/cron-auth'
import { sendGenericEmail } from '@/lib/email/core'
import { generateArtemisReminderEmail } from '@/lib/email/generators'
import { logTrainingEmail } from '@/lib/training/notifications'
import { TrainingEmailType } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Tomorrow in America/New_York calendar — reminders send once per booking per day. */
export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const [y0, m0, d0] = todayEt.split('-').map((x) => parseInt(x, 10))
    const tomorrowKey = new Date(y0, m0 - 1, d0 + 1).toLocaleDateString('en-CA', {
      timeZone: 'America/New_York',
    })

    const bookings = await prisma.trainingBooking.findMany({
      where: {
        attendanceStatus: 'BOOKED',
        trainingSession: {
          status: 'SCHEDULED',
          startTime: {
            gte: new Date(),
            lte: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        rbtProfile: { select: { id: true, firstName: true, email: true } },
        trainingSession: true,
      },
    })

    let sent = 0
    for (const b of bookings) {
      const sessionDayEt = b.trainingSession.startTime.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
      })
      if (sessionDayEt !== tomorrowKey) continue

      const email = b.rbtProfile.email
      if (!email) continue
      const dup = await prisma.trainingEmailLog.findFirst({
        where: {
          trainingSessionId: b.trainingSessionId,
          rbtProfileId: b.rbtProfileId,
          emailType: TrainingEmailType.REMINDER,
          sentAt: { gte: new Date(Date.now() - 20 * 3600000) },
        },
      })
      if (dup) continue

      const { subject, html } = generateArtemisReminderEmail({
        firstName: b.rbtProfile.firstName,
        sessionTitle: b.trainingSession.title,
        startTime: b.trainingSession.startTime,
        meetingUrl: b.trainingSession.meetingUrl,
      })
      await sendGenericEmail(email, subject, html)
      await logTrainingEmail({
        trainingSessionId: b.trainingSessionId,
        rbtProfileId: b.rbtProfileId,
        emailType: TrainingEmailType.REMINDER,
      })
      sent++
    }

    return NextResponse.json({ success: true, sent })
  } catch (e) {
    console.error('[cron training-reminders]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
