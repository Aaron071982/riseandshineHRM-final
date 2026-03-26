/**
 * Staleness digest cron. Run every other day (e.g. Vercel Cron 0 9 1,15 * *).
 * Auth: CRON_SECRET (Bearer or ?secret=).
 * Sends HTML digest to workflow_staleness_recipients or all active admins if empty.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWorkflowSettings } from '@/lib/workflow-settings'
import { sendGenericEmail } from '@/lib/email'
import { makePublicUrl } from '@/lib/baseUrl'
import { assertCronOrResponse } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface StaleRow {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  email: string | null
  daysStuck: number
  label?: string
}

function buildDigestHtml(sections: { title: string; rows: StaleRow[] }[]): string {
  const profileLink = (id: string) => makePublicUrl(`/admin/rbts/${id}`)

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 700px; margin: 0 auto; padding: 24px; }
    .header { background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .section { background: white; padding: 20px 24px; margin-bottom: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .section h2 { margin: 0 0 12px 0; font-size: 16px; color: #E4893D; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #555; }
    a { color: #E4893D; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #888; font-style: italic; }
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Rise and Shine HRM – Staleness Digest</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.95;">Candidate pipeline alerts</p>
    </div>
  `
  for (const { title, rows } of sections) {
    html += `<div class="section"><h2>${title}</h2>`
    if (rows.length === 0) {
      html += `<p class="empty">None</p>`
    } else {
      html += `<table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Days</th><th>Link</th></tr></thead><tbody>`
      for (const r of rows) {
        const name = `${r.firstName} ${r.lastName}`
        const link = profileLink(r.id)
        html += `<tr><td>${name}</td><td>${r.phoneNumber || '—'}</td><td>${r.email || '—'}</td><td>${r.daysStuck}</td><td><a href="${link}">View</a></td></tr>`
      }
      html += `</tbody></table>`
    }
    html += `</div>`
  }
  html += `<div class="footer"><p>Rise and Shine HRM – automated digest</p></div></div></body></html>`
  return html
}

export async function GET(request: NextRequest) {
  const auth = assertCronOrResponse(request)
  if (auth) return auth

  try {
    const workflow = await getWorkflowSettings()
    if (!workflow.stalenessDigest) {
      return NextResponse.json({ success: true, message: 'Staleness digest disabled' })
    }

    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000

    // Auto-restore scheduling proximity exclusions when expired.
    const expiredExclusions = await prisma.$queryRaw<
      Array<{
        id: string
        rbtProfileId: string
        excludedByUserId: string
        firstName: string | null
        lastName: string | null
      }>
    >`
      SELECT
        se.id,
        se."rbtProfileId",
        se."excludedByUserId",
        rp."firstName",
        rp."lastName"
      FROM scheduling_exclusions se
      LEFT JOIN rbt_profiles rp ON rp.id = se."rbtProfileId"
      WHERE se."expiresAt" IS NOT NULL
        AND se."expiresAt" <= NOW()
    `

    if (expiredExclusions.length > 0) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      })

      for (const exclusion of expiredExclusions) {
        const rbtName = [exclusion.firstName, exclusion.lastName].filter(Boolean).join(' ') || 'An RBT'

        await prisma.$executeRaw`
          DELETE FROM scheduling_exclusions WHERE id = ${exclusion.id}
        `

        for (const admin of admins) {
          await prisma.adminNotification.create({
            data: {
              userId: admin.id,
              type: 'SCHEDULING_EXCLUSION_EXPIRED',
              message: `${rbtName}'s scheduling exclusion has expired — they will now appear in proximity results again`,
              linkUrl: makePublicUrl('/admin/scheduling-beta'),
            },
          }).catch(() => {})
        }

        await prisma.activityLog.create({
          data: {
            userId: exclusion.excludedByUserId,
            activityType: 'BUTTON_CLICK',
            action: 'SCHEDULING_EXCLUSION_AUTO_RESTORED',
            resourceType: 'SCHEDULING_EXCLUSION',
            resourceId: exclusion.id,
            metadata: {
              rbtProfileId: exclusion.rbtProfileId,
              rbtName,
              reason: 'Expired in cron',
            },
          },
        }).catch(() => {})
      }
    }

    const reachOutThreshold = new Date(now.getTime() - workflow.stalenessDaysReachOut * dayMs)
    const toInterviewThreshold = new Date(now.getTime() - workflow.stalenessDaysToInterview * dayMs)
    const onboardingThreshold = new Date(now.getTime() - workflow.stalenessDaysOnboarding * dayMs)

    const reachOut: StaleRow[] = []
    const toInterview: StaleRow[] = []
    const interviewNotMarked: StaleRow[] = []
    const onboardingNotStarted: StaleRow[] = []

    const reachOutProfiles = await prisma.rBTProfile.findMany({
      where: { status: 'REACH_OUT', updatedAt: { lt: reachOutThreshold } },
      select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true, updatedAt: true },
    })
    for (const p of reachOutProfiles) {
      const daysStuck = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
      reachOut.push({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phoneNumber: p.phoneNumber,
        email: p.email,
        daysStuck,
      })
    }

    const toInterviewProfiles = await prisma.rBTProfile.findMany({
      where: { status: 'TO_INTERVIEW', updatedAt: { lt: toInterviewThreshold } },
      select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true, updatedAt: true },
    })
    for (const p of toInterviewProfiles) {
      const daysStuck = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
      toInterview.push({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phoneNumber: p.phoneNumber,
        email: p.email,
        daysStuck,
      })
    }

    const pastInterviews = await prisma.interview.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lt: now } },
      select: { rbtProfileId: true },
    })
    const profileIds = [...new Set(pastInterviews.map((i) => i.rbtProfileId))]
    if (profileIds.length > 0) {
      const profiles = await prisma.rBTProfile.findMany({
        where: { id: { in: profileIds }, status: 'INTERVIEW_SCHEDULED' },
        select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true, updatedAt: true },
      })
      for (const p of profiles) {
        const daysStuck = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
        interviewNotMarked.push({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          phoneNumber: p.phoneNumber,
          email: p.email,
          daysStuck,
          label: 'Interview not marked complete',
        })
      }
    }

    const hiredWithTasks = await prisma.rBTProfile.findMany({
      where: {
        status: 'HIRED',
        updatedAt: { lt: onboardingThreshold },
      },
      include: {
        onboardingTasks: { select: { isCompleted: true } },
      },
    })
    for (const p of hiredWithTasks) {
      const completed = p.onboardingTasks.filter((t) => t.isCompleted).length
      const total = p.onboardingTasks.length
      const progress = total === 0 ? 0 : (100 * completed) / total
      if (progress === 0) {
        const daysStuck = Math.floor((now.getTime() - p.updatedAt.getTime()) / dayMs)
        onboardingNotStarted.push({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          phoneNumber: p.phoneNumber,
          email: p.email,
          daysStuck,
          label: 'Onboarding not started',
        })
      }
    }

    const sections = [
      { title: `Stuck in Reach Out (${workflow.stalenessDaysReachOut}+ days)`, rows: reachOut },
      { title: `Stuck in To Interview (${workflow.stalenessDaysToInterview}+ days)`, rows: toInterview },
      { title: 'Interview not marked complete', rows: interviewNotMarked },
      { title: `Hired – onboarding not started (${workflow.stalenessDaysOnboarding}+ days)`, rows: onboardingNotStarted },
    ]

    const hasAny = sections.some((s) => s.rows.length > 0)
    let recipients: string[] = workflow.stalenessRecipients
    if (recipients.length === 0) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { email: true },
      })
      recipients = admins.map((a) => a.email).filter((e): e is string => !!e)
    }

    const html = buildDigestHtml(sections)
    const subject = hasAny
      ? `Rise and Shine HRM – Staleness digest (${sections.reduce((acc, s) => acc + s.rows.length, 0)} items)`
      : 'Rise and Shine HRM – Staleness digest (no items)'

    for (const to of recipients) {
      await sendGenericEmail(to, subject, html).catch((e) => console.error('Staleness digest send failed:', e))
    }

    if (hasAny && recipients.length > 0) {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      })
      const digestUrl = makePublicUrl('/admin/employees')
      for (const admin of adminUsers) {
        await prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type: 'STALENESS_ALERT',
            message: 'Staleness digest: candidates need attention',
            linkUrl: digestUrl,
          },
        }).catch(() => {})
      }
      for (const row of interviewNotMarked) {
        const profileUrl = makePublicUrl(`/admin/rbts/${row.id}`)
        const msg = `Interview not marked complete: ${row.firstName} ${row.lastName}`
        for (const admin of adminUsers) {
          await prisma.adminNotification.create({
            data: {
              userId: admin.id,
              type: 'INTERVIEW_NOT_MARKED',
              message: msg,
              linkUrl: profileUrl,
            },
          }).catch(() => {})
        }
      }
    }

    // ——— RBT reminder emails (Part 7 / plan) ———
    const tasksUrl = makePublicUrl('/rbt/tasks')
    const twoDaysAgo = new Date(now.getTime() - 2 * dayMs)
    const threeDaysAgo = new Date(now.getTime() - 3 * dayMs)

    // 1. Hired > 2 days, onboarding < 50%
    const hiredRecently = await prisma.rBTProfile.findMany({
      where: { status: 'HIRED', updatedAt: { lt: twoDaysAgo } },
      include: {
        onboardingTasks: { select: { isCompleted: true } },
        onboardingCompletions: { where: { status: 'COMPLETED' }, select: { id: true } },
      },
    })
    for (const p of hiredRecently) {
      const taskDone = p.onboardingTasks.filter((t) => t.isCompleted).length
      const taskTotal = p.onboardingTasks.length
      const docDone = p.onboardingCompletions.length
      const docTotal = await prisma.onboardingDocument.count({ where: { isActive: true } })
      const totalDone = taskDone + docDone
      const total = taskTotal + docTotal
      const pct = total > 0 ? Math.round((100 * totalDone) / total) : 0
      if (pct >= 50 || !p.email) continue
      const remaining = total - totalDone
      const html = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 22px;">Rise and Shine</h1>
            </div>
            <div style="padding: 24px; background: #fff; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi <strong>${p.firstName}</strong>,</p>
              <p>You're <strong>${pct}%</strong> through your onboarding. Just <strong>${remaining}</strong> step(s) left to get started.</p>
              <p><a href="${tasksUrl}" style="display: inline-block; padding: 12px 24px; background: #E4893D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Continue onboarding</a></p>
              <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br>The Rise and Shine Team</p>
            </div>
          </div>
        </body></html>
      `
      await sendGenericEmail(
        p.email,
        `You're ${pct}% there — finish your Rise and Shine onboarding`,
        html
      ).catch((e) => console.error('RBT onboarding reminder send failed:', e))
    }

    // 2. Onboarding 50–99%, no progress in 3 days
    const withProgress = await prisma.rBTProfile.findMany({
      where: { status: 'HIRED' },
      include: {
        onboardingTasks: { select: { isCompleted: true, completedAt: true } },
        onboardingCompletions: { select: { status: true, completedAt: true } },
      },
    })
    for (const p of withProgress) {
      const taskDone = p.onboardingTasks.filter((t) => t.isCompleted).length
      const taskTotal = p.onboardingTasks.length
      const docDone = p.onboardingCompletions.filter((c) => c.status === 'COMPLETED').length
      const docTotal = await prisma.onboardingDocument.count({ where: { isActive: true } })
      const totalDone = taskDone + docDone
      const total = taskTotal + docTotal
      const pct = total > 0 ? Math.round((100 * totalDone) / total) : 0
      if (pct < 50 || pct >= 100 || !p.email) continue
      const lastTask = p.onboardingTasks.filter((t) => t.completedAt).sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1))[0]
      const lastDoc = p.onboardingCompletions.filter((c) => c.completedAt).sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1))[0]
      const lastActivity = [lastTask?.completedAt, lastDoc?.completedAt].filter(Boolean).sort().pop()
      if (lastActivity && lastActivity >= threeDaysAgo) continue
      const remaining = total - totalDone
      const estMins = Math.max(5, remaining * 2)
      const html = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 22px;">Rise and Shine</h1>
            </div>
            <div style="padding: 24px; background: #fff; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi <strong>${p.firstName}</strong>,</p>
              <p>You're so close! Just <strong>${remaining}</strong> task(s) left. It should only take about <strong>${estMins} minutes</strong> to finish.</p>
              <p><a href="${tasksUrl}" style="display: inline-block; padding: 12px 24px; background: #E4893D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Complete onboarding</a></p>
              <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br>The Rise and Shine Team</p>
            </div>
          </div>
        </body></html>
      `
      await sendGenericEmail(
        p.email,
        `Almost there — ${remaining} step(s) left`,
        html
      ).catch((e) => console.error('RBT nudge send failed:', e))
    }

    // 3. Downloaded fillable PDF, no upload after 2 days
    const downloadedNoUpload = await prisma.onboardingCompletion.findMany({
      where: {
        downloadedAt: { not: null, lt: twoDaysAgo },
        signedPdfUrl: null,
        status: { not: 'COMPLETED' },
      },
      include: { document: true, rbtProfile: { select: { email: true, firstName: true } } },
    })
    for (const c of downloadedNoUpload) {
      if (!c.rbtProfile.email) continue
      const docTitle = c.document.title
      const html = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #E4893D 0%, #FF9F5A 100%); color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 22px;">Rise and Shine</h1>
            </div>
            <div style="padding: 24px; background: #fff; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi <strong>${c.rbtProfile.firstName}</strong>,</p>
              <p>You downloaded <strong>${docTitle}</strong> but haven't uploaded the completed version yet. When you're ready, log in and upload it from My Tasks.</p>
              <p><a href="${tasksUrl}" style="display: inline-block; padding: 12px 24px; background: #E4893D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to My Tasks</a></p>
              <p style="margin-top: 24px; font-size: 14px; color: #666;">Best regards,<br>The Rise and Shine Team</p>
            </div>
          </div>
        </body></html>
      `
      await sendGenericEmail(
        c.rbtProfile.email,
        `Reminder: upload your completed ${docTitle}`,
        html
      ).catch((e) => console.error('RBT fillable reminder send failed:', e))
    }

    // 4. Attendance alerts: forgot to clock out (>12h open), and unusually long sessions (>8h)
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const forgotClockOutEntries = await prisma.timeEntry.findMany({
      where: {
        clockOutTime: null,
        clockInTime: { lt: twelveHoursAgo },
      },
      include: {
        rbtProfile: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
        },
      },
      orderBy: { clockInTime: 'asc' },
    })
    const longSessions = await prisma.timeEntry.findMany({
      where: {
        clockOutTime: { not: null },
        totalHours: { gt: 8 },
      },
      include: {
        rbtProfile: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
        },
      },
      orderBy: { clockInTime: 'desc' },
      take: 50,
    })

    if (forgotClockOutEntries.length > 0 || longSessions.length > 0) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, email: true },
      })
      const adminEmails = admins.map((a) => a.email).filter((e): e is string => !!e)

      const attendanceHtml = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.5;color:#333;padding:24px;">
          <div style="max-width:680px;margin:0 auto;">
            <h2 style="margin:0 0 8px 0;color:#E4893D;">Attendance Alerts</h2>
            <p style="margin:0 0 16px 0;">Flagged sessions requiring admin attention.</p>
            <h3 style="margin:16px 0 8px 0;">Forgot to clock out (&gt;12h open): ${forgotClockOutEntries.length}</h3>
            <ul>
              ${forgotClockOutEntries
                .map((entry) => {
                  const hoursElapsed = Math.round(((now.getTime() - entry.clockInTime.getTime()) / 3600000) * 100) / 100
                  return `<li><strong>${entry.rbtProfile.firstName} ${entry.rbtProfile.lastName}</strong> (${entry.rbtProfile.phoneNumber || 'no phone'}) — clocked in ${entry.clockInTime.toLocaleString(
                    'en-US',
                    { timeZone: 'America/New_York' }
                  )} (${hoursElapsed}h) — <a href="${makePublicUrl('/admin/attendance')}">Edit their time entry</a></li>`
                })
                .join('')}
            </ul>
            <h3 style="margin:16px 0 8px 0;">Unusually long completed sessions (&gt;8h): ${longSessions.length}</h3>
            <ul>
              ${longSessions
                .map((entry) => `<li><strong>${entry.rbtProfile.firstName} ${entry.rbtProfile.lastName}</strong> — ${entry.totalHours?.toFixed(2)}h on ${entry.clockInTime.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</li>`)
                .join('')}
            </ul>
          </div>
        </body></html>
      `

      for (const email of adminEmails) {
        await sendGenericEmail(email, 'Attendance Alert: flagged sessions need attention', attendanceHtml).catch((e) =>
          console.error('Attendance admin alert send failed:', e)
        )
      }

      for (const admin of admins) {
        await prisma.adminNotification
          .create({
            data: {
              userId: admin.id,
              type: 'ATTENDANCE_ALERT',
              message: `Flagged sessions: ${forgotClockOutEntries.length} open over 12h, ${longSessions.length} long sessions`,
              linkUrl: makePublicUrl('/admin/attendance'),
            },
          })
          .catch(() => {})
      }

      for (const entry of forgotClockOutEntries) {
        if (!entry.rbtProfile.email) continue
        const rbtHtml = `
          <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
          <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.5;color:#333;padding:24px;">
            <div style="max-width:620px;margin:0 auto;">
              <h2 style="margin:0 0 8px 0;color:#E4893D;">Clock-out reminder</h2>
              <p>Hi <strong>${entry.rbtProfile.firstName}</strong>, it looks like you may have forgotten to clock out from your session that started at ${entry.clockInTime.toLocaleString(
                'en-US',
                { timeZone: 'America/New_York' }
              )}.</p>
              <p>Please log in and clock out, or contact your admin if you need help.</p>
              <p><a href="${makePublicUrl('/rbt/sessions')}" style="color:#E4893D;">Open Sessions</a></p>
            </div>
          </body></html>
        `
        await sendGenericEmail(
          entry.rbtProfile.email,
          'Reminder: you may have forgotten to clock out',
          rbtHtml
        ).catch((e) => console.error('RBT clock-out reminder send failed:', e))
      }
    }

    return NextResponse.json({
      success: true,
      sections: sections.map((s) => ({ title: s.title, count: s.rows.length })),
      recipientCount: recipients.length,
    })
  } catch (error) {
    console.error('Staleness alerts cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
