/*
 * SETUP REQUIRED:
 * 1. Set CRON_SECRET in Vercel Dashboard:
 *    Project → Settings → Environment Variables
 *    → Add: CRON_SECRET = [any random string]
 * 2. Vercel automatically signs cron requests
 *    with this secret — no other config needed
 * 3. Do NOT set this in GitHub secrets anymore
 *    as GitHub Actions crons are now disabled
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  EmailTemplateType,
} from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { assertAutomaticCronEmailsOrResponse, assertCronOrResponse } from '@/lib/cron-auth'
const REMINDER_MINUTES = parseInt(process.env.INTERVIEW_REMINDER_MINUTES ?? '15', 10)
const RECIPIENTS_RAW = process.env.INTERVIEW_REMINDER_RECIPIENTS ?? 'aaronsiam21@gmail.com,kazi@siyam.nyc'
const RECIPIENTS = RECIPIENTS_RAW.split(',').map((e) => e.trim()).filter(Boolean)

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth
  const emailsOff = assertAutomaticCronEmailsOrResponse()
  if (emailsOff) return emailsOff

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
            phoneNumber: true,
            email: true,
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
    const actorAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    })

    for (const interview of upcoming) {
      const candidateName = `${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`.trim()
      const profileLink = makePublicUrl(`/admin/rbts/${interview.rbtProfileId}`)
      const notesLink = makePublicUrl(`/admin/interviews/${interview.id}/notes`)
      const startAtEt = interview.scheduledAt.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
      const subject = `🚨 Interview Starting in 15 Minutes — ${candidateName}`
      const html = `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1f2937;margin:0;padding:0;background:#f5f5f5;">
          <div style="max-width:640px;margin:0 auto;">
            <div style="background:#dc2626;color:white;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;font-size:26px;font-weight:800;letter-spacing:.2px;">INTERVIEW IN 15 MINUTES</h1>
            </div>
            <div style="background:#fff;padding:24px 20px;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;">Candidate</p>
              <p style="margin:0 0 14px 0;font-size:28px;font-weight:800;color:#111827;">${candidateName}</p>
              <p style="margin:0 0 4px 0;font-size:16px;"><strong>Starting at ${startAtEt}</strong></p>
              <p style="margin:0 0 18px 0;font-size:14px;color:#6b7280;">Duration: 15 minutes</p>
              ${
                interview.meetingUrl
                  ? `<p style="margin:0 0 16px 0;">
                       <a href="${interview.meetingUrl}" style="display:inline-block;background:#16a34a;color:white !important;text-decoration:none;padding:16px 28px;border-radius:10px;font-weight:800;font-size:18px;">JOIN MEETING NOW</a>
                     </p>`
                  : ''
              }
              <p style="margin:0 0 10px 0;font-size:14px;color:#6b7280;">Candidate contact</p>
              <p style="margin:0 0 4px 0;">Phone: ${interview.rbtProfile.phoneNumber ? `<a href="tel:${interview.rbtProfile.phoneNumber}" style="color:#2563eb;">${interview.rbtProfile.phoneNumber}</a>` : '—'}</p>
              <p style="margin:0 0 18px 0;">Email: ${interview.rbtProfile.email ? `<a href="mailto:${interview.rbtProfile.email}" style="color:#2563eb;">${interview.rbtProfile.email}</a>` : '—'}</p>
              <p style="margin:0;">
                <a href="${profileLink}" style="display:inline-block;background:#f3f4f6;color:#111827 !important;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;margin-right:8px;">View Candidate Profile</a>
                <a href="${notesLink}" style="display:inline-block;background:#f3f4f6;color:#111827 !important;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Take Notes</a>
              </p>
              <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;">Sent by Rise & Shine HRM</p>
            </div>
          </div>
        </body></html>
      `

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
        if (actorAdmin?.id) {
          await prisma.activityLog.create({
            data: {
              userId: actorAdmin.id,
              activityType: 'FORM_SUBMISSION',
              action: 'CRON_INTERVIEW_REMINDER_15M_SENT',
              resourceType: 'Interview',
              resourceId: interview.id,
              url: '/api/cron/interview-reminders',
              metadata: {
                candidateName,
                scheduledAt: interview.scheduledAt.toISOString(),
                recipients: RECIPIENTS,
              },
            },
          }).catch(() => {})
        }
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
