import { NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email/core'
import { generateArtemisStaleReminderEmail } from '@/lib/email/generators'
import { trainingPortalUrl, logTrainingEmail } from '@/lib/training/notifications'
import { TrainingEmailType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  context: { params: Promise<{ rbtId: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const { rbtId } = await context.params

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtId },
    select: { id: true, firstName: true, email: true, artemisTrainingCompleted: true },
  })
  if (!profile?.email) {
    return NextResponse.json({ error: 'No email on file' }, { status: 400 })
  }
  if (profile.artemisTrainingCompleted) {
    return NextResponse.json({ error: 'Already trained' }, { status: 400 })
  }

  const upcoming = await prisma.trainingSession.findFirst({
    where: { status: 'SCHEDULED', startTime: { gt: new Date() } },
    orderBy: { startTime: 'asc' },
  })

  const { subject, html } = generateArtemisStaleReminderEmail({
    firstName: profile.firstName,
    trainingUrl: trainingPortalUrl(),
  })

  await sendGenericEmail(profile.email, subject, html)

  if (upcoming) {
    await logTrainingEmail({
      trainingSessionId: upcoming.id,
      rbtProfileId: profile.id,
      emailType: TrainingEmailType.REMINDER,
    })
  }

  return NextResponse.json({ ok: true })
}
