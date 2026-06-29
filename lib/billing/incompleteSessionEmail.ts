import { format } from 'date-fns'
import { sendGenericEmail } from '@/lib/email/core'

export const BILLING_CONTACT = 'Irsal@riseandshineaba.com'

export function generateIncompleteSessionReminderEmail(params: {
  firstName: string
  cycleLabel: string
  incompleteDates: Date[]
  incompleteSessionCount: number
  incompleteHours: number
}): string {
  const { firstName, cycleLabel, incompleteDates, incompleteSessionCount, incompleteHours } = params
  const dateLines = incompleteDates
    .map((d) => `<li>${format(d, 'MMMM d, yyyy')}</li>`)
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
  <p>Our payroll review for <strong>${cycleLabel}</strong> found <strong>${incompleteSessionCount}</strong> session${incompleteSessionCount === 1 ? '' : 's'} (${incompleteHours.toFixed(1)} hours) still marked <strong>Incomplete</strong> in Artemis.</p>
  <p>These sessions are not included in this pay cycle until they are completed/finalized in Artemis. Please complete your session notes as soon as possible so this work can be paid on the next run.</p>
  <p><strong>Incomplete session dates:</strong></p>
  <ul>${dateLines}</ul>
  <p>If you need help, contact <a href="mailto:${BILLING_CONTACT}" style="color:#0D9488;">${BILLING_CONTACT}</a>.</p>
  <p>Thank you,<br><strong>Rise &amp; Shine ABA Billing Team</strong></p>
</body>
</html>`
}

export async function sendIncompleteSessionReminderEmail(params: {
  to: string
  firstName: string
  cycleLabel: string
  incompleteDates: Date[]
  incompleteSessionCount: number
  incompleteHours: number
}): Promise<boolean> {
  const subject = `Action needed: complete your session notes — ${params.cycleLabel}`
  const html = generateIncompleteSessionReminderEmail(params)
  return sendGenericEmail(params.to, subject, html, undefined, BILLING_CONTACT)
}
