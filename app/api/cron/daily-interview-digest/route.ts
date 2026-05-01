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
import { assertCronOrResponse } from '@/lib/cron-auth'
import { makePublicUrl } from '@/lib/baseUrl'

function getEtDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getEtDayBounds(date: Date): { startUtc: Date; endUtc: Date; etDateKey: string } {
  const etDateKey = getEtDateKey(date)
  const startUtc = new Date(`${etDateKey}T04:00:00.000Z`)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc, endUtc, etDateKey }
}

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    const prismaAny = prisma as any
    const now = new Date()
    const { startUtc, endUtc, etDateKey } = getEtDayBounds(now)
    const digestDate = new Date(`${etDateKey}T00:00:00.000Z`)

    const interviews = await prismaAny.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: startUtc, lt: endUtc },
        OR: [{ dailyDigestDate: null }, { dailyDigestDate: { lt: digestDate } }],
      },
      include: {
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
        claimedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    if (interviews.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible interviews for today's digest",
        count: 0,
      })
    }

    const overrides = await prismaAny.adminAvailabilityOverride.findMany({
      where: {
        date: digestDate,
        overrideType: 'BLOCKED',
      },
      select: { userId: true },
    }).catch(() => [])
    const blockedUserIds = new Set(overrides.map((o) => o.userId))

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, email: true },
    })
    const recipientEmails = admins.map((a) => a.email).filter((e): e is string => !!e)
    if (recipientEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active admin email recipients',
        count: 0,
      })
    }

    const totalCount = interviews.length
    const rows = interviews
      .map((interview) => {
        const candidateName =
          `${interview.rbtProfile?.firstName ?? ''} ${interview.rbtProfile?.lastName ?? ''}`.trim() ||
          'Unknown candidate'
        const timeEt = interview.scheduledAt.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
        })
        const isUnclaimed = !interview.claimedByUserId
        const conflict = !!interview.claimedByUserId && blockedUserIds.has(interview.claimedByUserId)
        const claimedBy =
          interview.claimedBy?.name ??
          interview.claimedBy?.email ??
          (interview.interviewerName ? interview.interviewerName : 'Unclaimed')
        const joinCell = interview.meetingUrl
          ? `<a href="${interview.meetingUrl}" style="color:#16a34a;font-weight:700;">Join</a>`
          : '—'

        return {
          interview,
          html: `<tr style="${isUnclaimed ? 'background:#fef2f2;' : conflict ? 'background:#fff7ed;' : ''}">
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${timeEt}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
              <a href="${makePublicUrl(`/admin/rbts/${interview.rbtProfileId}`)}" style="color:#2563eb;text-decoration:none;">${candidateName}</a>
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${claimedBy}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
              ${isUnclaimed ? '<span style="color:#b91c1c;font-weight:700;">UNCLAIMED</span>' : '<span style="color:#166534;font-weight:700;">Scheduled</span>'}
              ${conflict ? '<div style="color:#b45309;font-weight:700;">⚠️ Potential conflict</div>' : ''}
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${joinCell}</td>
          </tr>`,
        }
      })
    const bodyRows = rows.map((r) => r.html).join('')
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#111827;background:#f3f4f6;margin:0;padding:0;">
        <div style="max-width:760px;margin:0 auto;">
          <div style="background:#1f2937;color:white;padding:22px 20px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:24px;">📅 Today's Interviews — Rise & Shine ABA</h1>
            <p style="margin:8px 0 0 0;color:#d1d5db;">Good morning! Here's your schedule for today.</p>
          </div>
          <div style="background:white;padding:20px;border-radius:0 0 12px 12px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Time (ET)</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Candidate</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Claimed By</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Status</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e7eb;">Join</th>
                </tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
            <p style="margin:14px 0 0 0;color:#374151;font-weight:700;">${totalCount} interviews today</p>
          </div>
        </div>
      </body></html>
    `

    const subject = "📅 Today's Interviews — Rise & Shine ABA"
    for (const email of recipientEmails) {
      await sendGenericEmail(email, subject, html).catch((e) =>
        console.error(`Failed sending daily digest to ${email}`, e)
      )
    }

    await prismaAny.interview.updateMany({
      where: { id: { in: interviews.map((i) => i.id) } },
      data: { dailyDigestDate: digestDate },
    })

    if (admins[0]?.id) {
      for (const row of rows) {
        await prisma.activityLog.create({
          data: {
            userId: admins[0].id,
            activityType: 'FORM_SUBMISSION',
            action: 'CRON_DAILY_INTERVIEW_DIGEST_SENT',
            resourceType: 'Interview',
            resourceId: row.interview.id,
            url: '/api/cron/daily-interview-digest',
            metadata: {
              digestDate: etDateKey,
              adminRecipientCount: recipientEmails.length,
            },
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily interview digest sent',
      interviewCount: interviews.length,
      recipientCount: recipientEmails.length,
    })
  } catch (error: unknown) {
    console.error('Error in daily-interview-digest cron:', error)
    return NextResponse.json(
      { error: 'Failed to process daily digest', details: String(error) },
      { status: 500 }
    )
  }
}
