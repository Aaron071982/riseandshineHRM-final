import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCronOrResponse } from '@/lib/cron-auth'
import { sendGenericEmail } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { getOnboardingProgress } from '@/lib/onboarding/progress'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const REMINDER_HOURS = [24, 72, 168] as const

export async function GET(request: NextRequest) {
  const denied = assertCronOrResponse(request)
  if (denied) return denied

  try {
    const hired = await prisma.rBTProfile.findMany({
      where: { status: 'HIRED', fullyActivatedAt: null, email: { not: null } },
      select: { id: true, email: true, firstName: true, updatedAt: true },
    })

    let sent = 0
    for (const rbt of hired) {
      let progress
      try {
        progress = await getOnboardingProgress(rbt.id)
      } catch {
        continue
      }
      if (progress.fullyActivated || progress.completedCount >= progress.totalRbtSteps) continue

      const hoursSince = (Date.now() - rbt.updatedAt.getTime()) / (3600 * 1000)
      const bucket = REMINDER_HOURS.find((h) => hoursSince >= h && hoursSince < h + 2)
      if (!bucket) continue

      const already = await prisma.activityLog.count({
        where: {
          action: `ONBOARDING_REMINDER_${bucket}H`,
          metadata: { path: ['rbtProfileId'], equals: rbt.id },
        },
      })
      if (already > 0) continue

      const html = `<p>Hi ${rbt.firstName},</p><p>You have incomplete onboarding steps (${progress.completedCount}/${progress.totalRbtSteps} done). Please log in to complete them.</p><p><a href="${makePublicUrl('/rbt/tasks')}">Open My Tasks</a></p>`
      await sendGenericEmail(
        rbt.email!,
        'Reminder: complete your onboarding — Rise & Shine',
        html
      ).catch(() => {})

      await prisma.activityLog.create({
        data: {
          userId: (await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }))?.id ?? rbt.id,
          activityType: 'FORM_SUBMISSION',
          action: `ONBOARDING_REMINDER_${bucket}H`,
          metadata: { rbtProfileId: rbt.id, hours: bucket },
        },
      }).catch(() => {})

      sent++
    }

    if (new Date().getDate() === 1) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true, email: { not: null } },
        select: { email: true },
      })
      for (const a of admins) {
        if (a.email) {
          await sendGenericEmail(
            a.email,
            'Monthly OIG/SAM/OMIG screening reminder',
            '<p>Review OIG screening logs for all active RBTs in the admin portal.</p>'
          ).catch(() => {})
        }
      }
    }

    return NextResponse.json({ success: true, remindersSent: sent })
  } catch (e) {
    console.error('[onboarding-reminders]', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
