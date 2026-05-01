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
import { sendGenericEmail } from '@/lib/email/core'
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
          select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true },
        },
        claimedBy: { select: { id: true, name: true, email: true } },
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
      select: { id: true, email: true, name: true },
    })

    let sentCount = 0

    for (const interview of upcoming) {
      const candidateName = `${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`.trim()
      const interviewLink = makePublicUrl('/admin/interviews')
      const notesLink = makePublicUrl(`/admin/interviews/${interview.id}/notes`)
      const profileLink = makePublicUrl(`/admin/rbts/${interview.rbtProfileId}`)
      const startAtEt = interview.scheduledAt.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
      const claimedByName = interview.claimedBy?.name ?? interview.claimedBy?.email ?? null
      const subject = `⏰ Interview in 1 Hour — ${candidateName} — Action Required`
      const html = `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1f2937;margin:0;padding:0;background:#f5f5f5;">
          <div style="max-width:640px;margin:0 auto;">
            <div style="background:#f97316;color:white;padding:24px 20px;text-align:center;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;font-size:24px;font-weight:800;">INTERVIEW IN 1 HOUR</h1>
            </div>
            <div style="background:#fff;padding:24px 20px;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 6px 0;font-size:14px;color:#6b7280;">Candidate</p>
              <p style="margin:0 0 10px 0;font-size:26px;font-weight:800;color:#111827;">${candidateName}</p>
              <p style="margin:0 0 12px 0;font-size:16px;"><strong>${startAtEt}</strong></p>
              ${
                interview.claimedByUserId
                  ? `<p style="margin:0 0 14px 0;background:#ecfdf5;color:#166534;border:1px solid #86efac;padding:10px;border-radius:8px;">✅ Claimed by ${claimedByName || 'Admin'}</p>`
                  : `<p style="margin:0 0 14px 0;background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5;padding:10px;border-radius:8px;font-weight:700;">⚠️ THIS INTERVIEW HAS NO ASSIGNED INTERVIEWER — Someone must claim it now</p>
                     <p style="margin:0 0 14px 0;">
                       <a href="${interviewLink}" style="display:inline-block;background:#dc2626;color:white !important;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;">Claim This Interview</a>
                     </p>`
              }
              ${
                interview.meetingUrl
                  ? `<p style="margin:0 0 12px 0;">
                       <a href="${interview.meetingUrl}" style="display:inline-block;background:#16a34a;color:white !important;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:800;">JOIN MEETING NOW</a>
                     </p>`
                  : ''
              }
              <p style="margin:0 0 8px 0;font-size:14px;color:#6b7280;">Candidate contact</p>
              <p style="margin:0 0 4px 0;">Phone: ${interview.rbtProfile.phoneNumber ? `<a href="tel:${interview.rbtProfile.phoneNumber}" style="color:#2563eb;">${interview.rbtProfile.phoneNumber}</a>` : '—'}</p>
              <p style="margin:0 0 14px 0;">Email: ${interview.rbtProfile.email ? `<a href="mailto:${interview.rbtProfile.email}" style="color:#2563eb;">${interview.rbtProfile.email}</a>` : '—'}</p>
              <p style="margin:0;">
                <a href="${notesLink}" style="color:#2563eb;margin-right:10px;">Take Notes</a>
                <a href="${profileLink}" style="color:#2563eb;margin-right:10px;">View Profile</a>
                ${interview.meetingUrl ? `<a href="${interview.meetingUrl}" style="color:#2563eb;">Join Meeting</a>` : ''}
              </p>
              <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;">Sent by Rise & Shine HRM</p>
            </div>
          </div>
        </body></html>
      `

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
      if (admins[0]?.id) {
        await prisma.activityLog.create({
          data: {
            userId: admins[0].id,
            activityType: 'FORM_SUBMISSION',
            action: 'CRON_INTERVIEW_REMINDER_1HR_SENT',
            resourceType: 'Interview',
            resourceId: interview.id,
            url: '/api/cron/interview-reminders-1hr',
            metadata: {
              candidateName,
              scheduledAt: interview.scheduledAt.toISOString(),
              adminRecipientCount: admins.filter((a) => !!a.email).length,
              claimedByUserId: interview.claimedByUserId,
            },
          },
        }).catch(() => {})
      }
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
