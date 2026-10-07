export const I9_OUTREACH_SENDER = { name: 'Rise & Shine HR', title: 'Human Resources' } as const
export const I9_OUTREACH_DUE_DAYS = 7

export const I9_COLLECTION_REQUEST_SUBJECT = 'Action needed: Form I-9 employment verification'
export const I9_COLLECTION_REMINDER_SUBJECT = 'Reminder: Form I-9 still needed'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatI9DueDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

export function i9DueDateFrom(sentAt: Date): Date {
  return new Date(sentAt.getTime() + I9_OUTREACH_DUE_DAYS * DAY_MS)
}

function easternDateKey(d: Date): number {
  const [y, m, day] = d
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    .split('-')
    .map(Number)
  return Date.UTC(y, m - 1, day)
}

/** Whole calendar days (America/New_York) from `from` to `to`. */
export function easternCalendarDaysBetween(from: Date, to: Date): number {
  return Math.round((easternDateKey(to) - easternDateKey(from)) / DAY_MS)
}

/** Which reminder (if any) is due for a request sent at `sentAt`; only the latest due reminder is sent. */
export function dueI9Reminder(
  sentAt: Date,
  now: Date,
  alreadySent: { day3: boolean; day7: boolean }
): 3 | 7 | null {
  const days = easternCalendarDaysBetween(sentAt, now)
  if (alreadySent.day7) return null
  if (days >= 7) return 7
  if (days >= 3 && !alreadySent.day3) return 3
  return null
}

const P = 'margin:0 0 16px;'

function layout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.65;color:#333;margin:0;padding:0;background-color:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;padding:16px;">
    <div style="background:linear-gradient(135deg,#E4893D 0%,#FF9F5A 100%);color:#fff;padding:32px 20px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:26px;font-weight:700;">Rise &amp; Shine ABA</h1>
    </div>
    <div style="padding:28px 24px;background:#ffffff;border-left:1px solid #eee;border-right:1px solid #eee;">
${body}
    </div>
    <div style="padding:20px;text-align:center;font-size:12px;color:#666;background:#f9f9f9;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none;">
      <p style="margin:0;"><strong>Rise &amp; Shine ABA LLC</strong></p>
    </div>
  </div>
</body>
</html>`
}

function taskButton(link: string, label: string): string {
  const href = escapeHtml(link)
  return `<p style="text-align:center;margin:24px 0 8px;">
        <a href="${href}" style="display:inline-block;background:#E4893D;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-size:16px;">${label}</a>
      </p>
      <p style="text-align:center;margin:0 0 20px;font-size:13px;color:#666;word-break:break-all;">${href}</p>`
}

export function generateI9CollectionRequestEmail(input: {
  firstName: string
  i9TaskLink: string
  dueDate: Date
}): { subject: string; html: string } {
  const name = escapeHtml(input.firstName.trim() || 'there')
  const html = layout(`      <p style="${P}">Hi ${name},</p>
      <p style="${P}">We&apos;re updating our employment records at Rise &amp; Shine ABA, and we need to complete or re-confirm your <strong>Form I-9 (Employment Eligibility Verification)</strong>.</p>
      <p style="${P}">Form I-9 is required by federal law for every employee in the United States. Our records don&apos;t currently show a completed I-9 on file for you — in some cases this is because a form was completed previously but wasn&apos;t stored in our current system. Either way, we need to get it properly on file.</p>
      <p style="${P}"><strong>Complete your I-9 online</strong><br>Log in to your Rise &amp; Shine HRM portal and open your I-9 task:</p>
      ${taskButton(input.i9TaskLink, 'Open my I-9 task')}
      <p style="${P}">There you&apos;ll fill out Section 1 and upload your identity and work-authorization documents. You may choose <strong>either one document from List A</strong>, <em>or</em> <strong>one from List B plus one from List C</strong>. The portal shows the full list of acceptable documents — the choice of which to present is entirely yours.</p>
      <p style="${P}"><strong>Please complete this by ${escapeHtml(formatI9DueDate(input.dueDate))}.</strong></p>
      <p style="margin:0 0 8px;"><strong>A few important notes:</strong></p>
      <ul style="margin:0 0 16px;padding-left:22px;">
        <li style="margin-bottom:8px;"><strong>Please do not email photos or scans of your documents.</strong> Upload them only through the secure portal link above — it keeps your personal information protected.</li>
        <li style="margin-bottom:8px;">You choose which acceptable documents to present. We cannot and will not require any specific document.</li>
        <li style="margin-bottom:8px;">This request is going to all staff whose I-9 isn&apos;t currently on file. It isn&apos;t specific to you, and it has nothing to do with your performance or standing with us.</li>
      </ul>
      <p style="${P}">If you have any questions, or if you believe you&apos;ve already completed an I-9 with us, just reply to this email and we&apos;ll look into it.</p>
      <p style="${P}">Thank you for taking care of this quickly.</p>
      <p style="margin:0;">${I9_OUTREACH_SENDER.name}<br>${I9_OUTREACH_SENDER.title}<br>Rise &amp; Shine ABA LLC</p>`)
  return { subject: I9_COLLECTION_REQUEST_SUBJECT, html }
}

export function generateI9CollectionReminderEmail(input: {
  firstName: string
  i9TaskLink: string
}): { subject: string; html: string } {
  const name = escapeHtml(input.firstName.trim() || 'there')
  const html = layout(`      <p style="${P}">Hi ${name},</p>
      <p style="${P}">A quick reminder that we still need your <strong>Form I-9</strong> on file. It&apos;s a federal requirement for all employees, and it&apos;s a short task.</p>
      <p style="margin:0;">Start here:</p>
      ${taskButton(input.i9TaskLink, 'Open my I-9 task')}
      <p style="${P}">If you&apos;ve already done this or have questions, just reply and let us know.</p>
      <p style="margin:0;">Thanks,<br>${I9_OUTREACH_SENDER.name}<br>Rise &amp; Shine ABA LLC</p>`)
  return { subject: I9_COLLECTION_REMINDER_SUBJECT, html }
}
