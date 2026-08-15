import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { assertCrmCronOrResponse } from '@/lib/cron-auth'
import { getClientServicesFullAccessEmails } from '@/lib/client-services/constants'
import { loadManagerDashboard } from '@/lib/crm/dashboard'
import {
  crmEmailsEnabled,
  isCrmEmailProductionEnv,
  resolveCrmEmailRecipient,
} from '@/lib/crm/emails/safety'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Weekday CRM manager digest.
 * Auth: Authorization: Bearer <CRON_SECRET> (required).
 * Sends only when CRM_EMAILS_ENABLED=true; non-prod redirects to test inbox.
 */
export async function GET(request: NextRequest) {
  const denied = assertCrmCronOrResponse(request)
  if (denied) return denied

  if (!crmEmailsEnabled()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'CRM_EMAILS_ENABLED is not true',
    })
  }

  try {
    const emails = getClientServicesFullAccessEmails()
    const managers = await prisma.user.findMany({
      where: { email: { in: emails, mode: 'insensitive' } },
      select: { id: true, email: true, name: true },
    })

    if (managers.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'No full-access managers found',
      })
    }

    // Org-wide dashboard via a full-access manager as actor
    const actor = managers[0]!
    const data = await loadManagerDashboard({
      id: actor.id,
      email: actor.email,
      name: actor.name,
      role: 'ADMIN',
      phoneNumber: null,
      fullAccess: true,
    })

    const urgentAuth = data.health.authExpiring
      .filter((b) => b.band <= 7)
      .flatMap((b) => b.items)
    const html = buildDigestHtml(data, urgentAuth)

    const key = process.env.RESEND_API_KEY
    if (!key) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'RESEND_API_KEY not configured',
      })
    }

    const resend = new Resend(key)
    const from = process.env.EMAIL_FROM || 'noreply@riseandshineaba.com'
    const fromAddress = from.includes('@')
      ? `"Rise & Shine ABA" <${from}>`
      : from

    let sent = 0
    let redirected = 0
    const errors: string[] = []

    for (const m of managers) {
      if (!m.email) continue
      // Manager digest: in non-prod, still force test inbox (never blast real managers from staging)
      const resolved = isCrmEmailProductionEnv()
        ? { to: m.email, redirected: false as boolean }
        : resolveCrmEmailRecipient(m.email)

      const to = isCrmEmailProductionEnv()
        ? m.email
        : resolved.to

      if (!to) {
        errors.push(`${m.email}: dropped (no test inbox)`)
        continue
      }
      if (!isCrmEmailProductionEnv()) redirected++

      try {
        const result = await resend.emails.send({
          from: fromAddress,
          to,
          subject: isCrmEmailProductionEnv()
            ? `CRM digest — ${data.kpis.needsAttention} need attention`
            : `[TEST] CRM digest — ${data.kpis.needsAttention} need attention`,
          html,
        })
        if (result.error) {
          errors.push(`${to}: ${result.error.message}`)
        } else {
          sent++
        }
      } catch (err) {
        errors.push(`${to}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      redirected,
      managerCount: managers.length,
      kpis: data.kpis,
      errors: errors.length ? errors : undefined,
    })
  } catch (err) {
    console.error('[crm-digest] failed', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

function buildDigestHtml(
  data: Awaited<ReturnType<typeof loadManagerDashboard>>,
  urgentAuth: { clientName: string; daysLeft: number; clientCode: string }[]
): string {
  const { kpis, queues } = data
  const row = (label: string, n: number) =>
    `<tr><td style="padding:6px 0;color:#5c5248;">${label}</td><td style="padding:6px 0;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${n}</td></tr>`

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f7f3ee;color:#2c241c;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fffaf4;border:1px solid #e8ddd0;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 4px;font-size:20px;">Case coordination digest</h1>
    <p style="margin:0 0 20px;color:#6b5e52;font-size:14px;">Rise &amp; Shine ABA · weekday summary</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      ${row('In pipeline', kpis.inPipeline)}
      ${row('Active clients', kpis.activeClients)}
      ${row('Needs attention', kpis.needsAttention)}
      ${row('Auth expiring ≤60d', kpis.authExpiring60)}
    </table>
    <h2 style="font-size:15px;margin:0 0 8px;">Queues</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      ${row('Intake · inquiries', queues.intake.newInquiries)}
      ${row('Intake · uncontacted', queues.intake.uncontacted)}
      ${row('Clinical · assessment overdue', queues.clinical.assessmentOverdue)}
      ${row('Auth · pending', queues.authorization.pending)}
      ${row('Staffing · RBT search', queues.staffing.rbtSearch)}
      ${row('Active · RBT replacement', queues.active.rbtReplacement)}
      ${row('Active · service gaps', queues.active.serviceGaps)}
    </table>
    <h2 style="font-size:15px;margin:0 0 8px;">Urgent auth (≤7d)</h2>
    ${
      urgentAuth.length === 0
        ? `<p style="color:#6b5e52;font-size:14px;">None — nice.</p>`
        : `<ul style="margin:0;padding-left:18px;font-size:14px;">${urgentAuth
            .map(
              (i) =>
                `<li>${i.clientName} (${i.clientCode}) · ${i.daysLeft}d</li>`
            )
            .join('')}</ul>`
    }
  </div>
</body></html>`
}
