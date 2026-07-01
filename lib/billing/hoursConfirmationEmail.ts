import { format } from 'date-fns'
import { sendGenericEmail } from '@/lib/email/core'
import { calendarDateKey, formatCalendarDate } from '@/lib/billing/calendarDate'
import {
  ARTEMIS_STATUS,
  isAlwaysExcludedStatus,
  normalizeArtemisStatus,
  computePayableHours,
  type ArtemisSessionStatusKey,
} from '@/lib/billing/sessionStatus'

const BILLING_CONTACT = 'Irsal@riseandshineaba.com'

export type HoursConfirmationSession = {
  dos: Date
  actualMinutes: number
  sessionStatus: string | null
}

function dosKey(dos: Date): string {
  return calendarDateKey(dos)
}

function formatDos(dos: Date): string {
  return formatCalendarDate(dos)
}

/** Completed + Ready to Bill — grouped as "completed" in the BT-facing email. */
export function isEmailCompletedStatus(status: string | null | undefined): boolean {
  const key = normalizeArtemisStatus(status)
  return key === ARTEMIS_STATUS.COMPLETED || key === ARTEMIS_STATUS.READY_TO_BILL
}

export function filterIncompleteSessions(sessions: HoursConfirmationSession[]): HoursConfirmationSession[] {
  return sessions.filter(
    (s) => normalizeArtemisStatus(s.sessionStatus) === ARTEMIS_STATUS.INCOMPLETE
  )
}

export function sumCompletedHours(sessions: HoursConfirmationSession[]): number {
  let minutes = 0
  for (const s of sessions) {
    if (isEmailCompletedStatus(s.sessionStatus)) minutes += s.actualMinutes
  }
  return minutes / 60
}

export function sumIncompleteHours(sessions: HoursConfirmationSession[]): number {
  return filterIncompleteSessions(sessions).reduce((sum, s) => sum + s.actualMinutes / 60, 0)
}

export function countDaysWorked(sessions: HoursConfirmationSession[]): number {
  const days = new Set<string>()
  for (const s of sessions) {
    const key = normalizeArtemisStatus(s.sessionStatus)
    if (key && isAlwaysExcludedStatus(key)) continue
    if (s.actualMinutes <= 0) continue
    days.add(dosKey(s.dos))
  }
  return days.size
}

export function groupSessionsByDateForEmail(sessions: HoursConfirmationSession[]): {
  date: Date
  completedHours: number
  incompleteHours: number
}[] {
  const byDay = new Map<string, { completedMinutes: number; incompleteMinutes: number }>()
  for (const s of sessions) {
    const key = normalizeArtemisStatus(s.sessionStatus)
    if (key && isAlwaysExcludedStatus(key)) continue
    if (s.actualMinutes <= 0) continue

    const day = dosKey(s.dos)
    if (!byDay.has(day)) byDay.set(day, { completedMinutes: 0, incompleteMinutes: 0 })
    const row = byDay.get(day)!
    if (isEmailCompletedStatus(s.sessionStatus)) {
      row.completedMinutes += s.actualMinutes
    } else if (key === ARTEMIS_STATUS.INCOMPLETE) {
      row.incompleteMinutes += s.actualMinutes
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => ({
      date: new Date(key + 'T12:00:00.000Z'),
      completedHours: row.completedMinutes / 60,
      incompleteHours: row.incompleteMinutes / 60,
    }))
    .filter((d) => d.completedHours > 0 || d.incompleteHours > 0)
}

export type PayrollConfirmationParams = {
  firstName: string
  cycleLabel: string
  periodStart: Date
  periodEnd: Date
  sessions: HoursConfirmationSession[]
  payableStatuses: ArtemisSessionStatusKey[]
}

export function buildPayrollConfirmation(params: PayrollConfirmationParams) {
  const { sessions, payableStatuses, ...rest } = params

  const completedHours = sumCompletedHours(sessions)
  const incompleteHours = sumIncompleteHours(sessions)
  const payableHours = computePayableHours(sessions, payableStatuses)
  const dailyBreakdown = groupSessionsByDateForEmail(sessions)
  const daysWorked = countDaysWorked(sessions)

  return {
    ...rest,
    sessions,
    payableStatuses,
    completedHours,
    incompleteHours,
    payableHours,
    dailyBreakdown,
    daysWorked,
  }
}

export function generateHoursConfirmationEmail(
  data: ReturnType<typeof buildPayrollConfirmation>
): string {
  const {
    firstName,
    cycleLabel,
    periodStart,
    periodEnd,
    daysWorked,
    completedHours,
    incompleteHours,
    payableHours,
    dailyBreakdown,
  } = data

  const periodStr = `${format(periodStart, 'MM/dd/yyyy')} to ${format(periodEnd, 'MM/dd/yyyy')}`
  const hasIncomplete = incompleteHours > 0

  const dailyRows = dailyBreakdown
    .map((d) => {
      const completed =
        d.completedHours > 0 ? d.completedHours.toFixed(2) : '—'
      const incomplete =
        d.incompleteHours > 0 ? d.incompleteHours.toFixed(2) : '—'
      return (
        `<tr>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${formatDos(d.date)}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${completed}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${incomplete}</td>` +
        `</tr>`
      )
    })
    .join('')

  const incompleteSection = hasIncomplete
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-weight:bold;color:#92400e;">Action required — incomplete sessions</p>
        <p style="margin:0;font-size:14px;color:#78350f;">
          You have <strong>${incompleteHours.toFixed(2)} hours</strong> still marked <strong>Incomplete</strong> in Artemis.
          Please log in and complete those sessions on your end as soon as possible.
          If a session cannot be completed, email <a href="mailto:${BILLING_CONTACT}" style="color:#0D9488;">${BILLING_CONTACT}</a> right away.
          Continued incomplete sessions may result in further action.
        </p>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
  <div style="border-left:4px solid #0D9488;padding-left:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:20px;color:#0D9488;">Rise &amp; Shine ABA</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Hours Confirmation</p>
  </div>
  <p>Hi ${firstName},</p>
  <p>Please review your hours for the <strong>${periodStr}</strong> pay period (<strong>${cycleLabel}</strong>). Below is a summary of your sessions from our Artemis payroll review.</p>

  <table style="width:100%;font-size:14px;margin:16px 0;background:#f0fdfa;border-radius:8px;border-collapse:collapse;">
    <tr><td style="padding:12px 16px 4px;">Days worked</td><td style="padding:12px 16px 4px;text-align:right;font-weight:bold;">${daysWorked}</td></tr>
    <tr><td style="padding:4px 16px;">Completed hours</td><td style="padding:4px 16px;text-align:right;font-weight:bold;">${completedHours.toFixed(2)}</td></tr>
    <tr><td style="padding:4px 16px;">Incomplete hours</td><td style="padding:4px 16px;text-align:right;font-weight:bold;${hasIncomplete ? 'color:#d97706;' : ''}">${incompleteHours.toFixed(2)}</td></tr>
    <tr><td style="padding:4px 16px 12px;border-top:1px solid #99f6e4;">Total payable hours</td><td style="padding:4px 16px 12px;text-align:right;font-weight:bold;border-top:1px solid #99f6e4;">${payableHours.toFixed(2)}</td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Date</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Completed hrs</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Incomplete hrs</th>
      </tr>
    </thead>
    <tbody>
      ${dailyRows || '<tr><td colspan="3" style="padding:12px;color:#6b7280;">No session detail available.</td></tr>'}
      <tr style="font-weight:bold;background:#f9fafb;">
        <td style="padding:10px 12px;">Totals</td>
        <td style="padding:10px 12px;text-align:right;">${completedHours.toFixed(2)}</td>
        <td style="padding:10px 12px;text-align:right;">${incompleteHours.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${incompleteSection}

  <p>Thank you,<br><strong>Rise &amp; Shine ABA Billing Team</strong></p>
</body>
</html>`
}

export async function sendHoursConfirmationEmail(
  to: string,
  data: ReturnType<typeof buildPayrollConfirmation>
): Promise<boolean> {
  const subject = `Your hours confirmation — ${data.cycleLabel}`
  const html = generateHoursConfirmationEmail(data)
  return sendGenericEmail(to, subject, html, undefined, BILLING_CONTACT)
}

export type TaxDisclaimerParams = {
  firstName: string
  cycleLabel: string
  periodStart: Date
  periodEnd: Date
}

export function generateTaxDisclaimerEmail(params: TaxDisclaimerParams): string {
  const { firstName, cycleLabel, periodStart, periodEnd } = params
  const periodStr = `${format(periodStart, 'MM/dd/yyyy')} to ${format(periodEnd, 'MM/dd/yyyy')}`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
  <div style="border-left:4px solid #0D9488;padding-left:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:20px;color:#0D9488;">Rise &amp; Shine ABA</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Payroll Notice</p>
  </div>
  <p>Hi ${firstName},</p>
  <p>This is a payroll notice for the <strong>${periodStr}</strong> pay period (<strong>${cycleLabel}</strong>).</p>
  <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;margin:20px 0;">
    <p style="margin:0;font-size:14px;color:#065f46;">
      <strong>Please note:</strong> Federal and state taxes, along with any other applicable payroll deductions,
      will be withheld from your pay for this period. Your take-home pay will reflect these withholdings.
    </p>
  </div>
  <p>If you have any questions about your pay or deductions, please email
    <a href="mailto:${BILLING_CONTACT}" style="color:#0D9488;">${BILLING_CONTACT}</a>.</p>
  <p>Thank you,<br><strong>Rise &amp; Shine ABA Billing Team</strong></p>
</body>
</html>`
}

export async function sendTaxDisclaimerEmail(
  to: string,
  params: TaxDisclaimerParams
): Promise<boolean> {
  const subject = `Payroll tax notice — ${params.cycleLabel}`
  const html = generateTaxDisclaimerEmail(params)
  return sendGenericEmail(to, subject, html, undefined, BILLING_CONTACT)
}
