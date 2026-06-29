import { format } from 'date-fns'
import { sendGenericEmail } from '@/lib/email/core'
import { ARTEMIS_STATUS, normalizeArtemisStatus } from '@/lib/billing/sessionStatus'

const BILLING_CONTACT = 'Irsal@riseandshineaba.com'

export function getPayDeadline(periodEnd: Date): string {
  const day = periodEnd.getUTCDate()
  return day <= 15 ? 'the 1st' : 'the 15th'
}

export type HoursConfirmationSession = {
  dos: Date
  actualMinutes: number
  sessionStatus: string | null
}

export function filterIncompleteSessions(sessions: HoursConfirmationSession[]): HoursConfirmationSession[] {
  return sessions.filter(
    (s) => normalizeArtemisStatus(s.sessionStatus) === ARTEMIS_STATUS.INCOMPLETE
  )
}

export function groupIncompleteSessionsByDate(
  sessions: HoursConfirmationSession[]
): { date: Date; hours: number }[] {
  const incomplete = filterIncompleteSessions(sessions)
  const byDay = new Map<string, number>()
  for (const s of incomplete) {
    const key = format(s.dos, 'yyyy-MM-dd')
    byDay.set(key, (byDay.get(key) ?? 0) + s.actualMinutes / 60)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, hours]) => ({ date: new Date(key + 'T12:00:00'), hours }))
}

export function sumIncompleteHours(sessions: HoursConfirmationSession[]): number {
  return filterIncompleteSessions(sessions).reduce((sum, s) => sum + s.actualMinutes / 60, 0)
}

export function generateHoursConfirmationEmail(params: {
  firstName: string
  cycleLabel: string
  periodStart: Date
  periodEnd: Date
  dailyHours: { date: Date; hours: number }[]
  totalHours: number
}): string {
  const { firstName, cycleLabel, periodStart, periodEnd, dailyHours, totalHours } = params
  const periodStr = `${format(periodStart, 'MM/dd/yyyy')} to ${format(periodEnd, 'MM/dd/yyyy')}`
  const payDeadline = getPayDeadline(periodEnd)

  const rows = dailyHours
    .map(
      (d) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${format(d.date, 'MM/dd')}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${d.hours.toFixed(1)}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
  <div style="border-left:4px solid #0D9488;padding-left:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:20px;color:#0D9488;">Rise &amp; Shine ABA</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Billing Team</p>
  </div>
  <p>Hi ${firstName},</p>
  <p>Our payroll review for the <strong>${periodStr}</strong> pay period (${cycleLabel}) found sessions still marked <strong>Incomplete</strong> in Artemis for you. Please review the incomplete hours below and complete or correct them in Artemis if needed.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
    <thead>
      <tr style="background:#fffbeb;">
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #d97706;">Date</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #d97706;">Incomplete hrs</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="font-weight:bold;background:#f9fafb;">
        <td style="padding:10px 12px;">Total incomplete</td>
        <td style="padding:10px 12px;text-align:right;">${totalHours.toFixed(1)} hours</td>
      </tr>
    </tbody>
  </table>
  <p>Scheduled, completed, and other non-incomplete sessions are not included in this email.</p>
  <p>If everything looks correct, no action is needed.</p>
  <p>If you believe there is a discrepancy, please email <a href="mailto:${BILLING_CONTACT}" style="color:#0D9488;">${BILLING_CONTACT}</a> before the pay date (<strong>${payDeadline}</strong>). Unfortunately, we are unable to make adjustments to this pay period after that date, so please reach out promptly if something does not look right.</p>
  <p>Thank you,<br><strong>Rise &amp; Shine ABA Billing Team</strong></p>
</body>
</html>`
}

export async function sendHoursConfirmationEmail(params: {
  to: string
  firstName: string
  cycleLabel: string
  periodStart: Date
  periodEnd: Date
  dailyHours: { date: Date; hours: number }[]
  totalHours: number
}): Promise<boolean> {
  const subject = `Please review your incomplete hours — ${params.cycleLabel}`
  const html = generateHoursConfirmationEmail(params)
  return sendGenericEmail(params.to, subject, html, undefined, BILLING_CONTACT)
}
