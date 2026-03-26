import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email/core'
import { generateInterviewReminder1hrEmail } from '@/lib/email/generators'
import { makePublicUrl } from '@/lib/baseUrl'
import { assertCronOrResponse } from '@/lib/cron-auth'

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    const now = new Date()
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000)

    const upcoming = await prisma.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: windowStart, lte: windowEnd },
        reminder_1hr_sent_at: null,
      },
      include: {
        rbtProfile: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    if (upcoming.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No interviews in 1hr window',
        count: 0,
      })
    }

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, email: true },
    })

    let sentCount = 0

    for (const interview of upcoming) {
      const candidateName = `${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`.trim()
      const interviewLink = makePublicUrl(`/admin/interviews`)
      const { subject, html } = generateInterviewReminder1hrEmail(
        candidateName,
        interview.scheduledAt,
        interview.meetingUrl,
        interviewLink
      )

      for (const admin of admins) {
        if (!admin.email) continue
        await sendGenericEmail(admin.email, subject, html).catch((e) =>
          console.error(`Failed to send 1hr reminder to ${admin.email}:`, e)
        )
      }

      for (const admin of admins) {
        await prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type: 'INTERVIEW_1HR_REMINDER',
            message: `Interview with ${candidateName} in ~1 hour${!interview.claimedByUserId ? ' (UNCLAIMED!)' : ''}`,
            linkUrl: '/admin/interviews',
          },
        }).catch(() => {})
      }

      await prisma.interview.update({
        where: { id: interview.id },
        data: { reminder_1hr_sent_at: now },
      })
      sentCount++
    }

    return NextResponse.json({
      success: true,
      message: `Sent 1hr reminders for ${sentCount} interviews`,
      sentCount,
    })
  } catch (error: unknown) {
    console.error('Error in interview-reminders-1hr cron:', error)
    return NextResponse.json(
      { error: 'Failed to process 1hr reminders', details: String(error) },
      { status: 500 }
    )
  }
}
