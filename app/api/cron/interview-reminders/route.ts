/**
 * 15-minute interview reminder cron.
 * Sends reminders for interviews starting in ~15 minutes (configurable via INTERVIEW_REMINDER_MINUTES, default 15).
 * Uses Interview.reminder_15m_sent_at to avoid duplicate sends. Auth: CRON_SECRET (Bearer or ?secret=).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  EmailTemplateType,
  generateInterviewReminder15mEmail,
} from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { assertCronOrResponse } from '@/lib/cron-auth'
const REMINDER_MINUTES = parseInt(process.env.INTERVIEW_REMINDER_MINUTES ?? '15', 10)
const RECIPIENTS_RAW = process.env.INTERVIEW_REMINDER_RECIPIENTS ?? 'aaronsiam21@gmail.com,kazi@siyam.nyc'
const RECIPIENTS = RECIPIENTS_RAW.split(',').map((e) => e.trim()).filter(Boolean)

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    const now = new Date()
    const targetStart = new Date(now.getTime() + REMINDER_MINUTES * 60 * 1000)
    const windowStart = new Date(targetStart.getTime() - 1 * 60 * 1000)
    const windowEnd = new Date(targetStart.getTime() + 1 * 60 * 1000)

    const upcoming = await prisma.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: windowStart, lte: windowEnd },
        reminder_15m_sent_at: null,
      },
      include: {
        rbtProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (upcoming.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No interviews in 15m window',
        count: 0,
      })
    }

    let sentCount = 0
    let errorCount = 0

    for (const interview of upcoming) {
      const candidateName = `${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`.trim()
      const interviewLink = makePublicUrl(`/admin/rbts/${interview.rbtProfileId}`)
      const { subject, html } = generateInterviewReminder15mEmail(
        candidateName,
        interview.scheduledAt,
        interviewLink,
        interview.interviewerName || undefined
      )

      let allSent = true
      for (const to of RECIPIENTS) {
        const ok = await sendEmail({
          to,
          subject,
          html,
          templateType: EmailTemplateType.INTERVIEW_INVITE,
          rbtProfileId: interview.rbtProfileId,
        })
        if (!ok) {
          allSent = false
          console.error(`Failed to send 15m reminder to ${to} for interview ${interview.id}`)
        }
      }

      if (allSent) {
        await prisma.interview.update({
          where: { id: interview.id },
          data: { reminder_15m_sent_at: now },
        })
        sentCount++
      } else {
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${upcoming.length} interviews`,
      sentCount,
      errorCount,
    })
  } catch (error: unknown) {
    console.error('Error in interview-reminders cron:', error)
    return NextResponse.json(
      { error: 'Failed to process interview reminders', details: String(error) },
      { status: 500 }
    )
  }
}
