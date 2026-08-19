import type { CommTemplate } from '@prisma/client'

export type JourneyMergeFields = {
  childFirstName: string
  childLastName: string
  parentName: string | null
  coordinatorName: string | null
  coordinatorEmail: string | null
  rbtName: string | null
  startDate: string | null
  assessmentDate: string | null
  companyPhone: string
  companyName: string
}

export type RenderedJourneyEmail = {
  template: CommTemplate
  subject: string
  html: string
  text: string
}

const COMPANY = 'Rise & Shine ABA'
const PHONE = '(718) 555-0100'

function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f7f3ee;font-family:Georgia,'Times New Roman',serif;color:#2c241c;">
  <div style="max-width:560px;margin:24px auto;background:#fffaf4;border:1px solid #e8ddd0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;background:linear-gradient(135deg,#e4893d,#ff9f5a);color:#fff;">
      <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">${COMPANY}</div>
      <div style="font-size:13px;opacity:0.95;margin-top:4px;">Supporting your family every step</div>
    </div>
    <div style="padding:24px;font-size:15px;line-height:1.55;">
      ${bodyHtml}
      <p style="margin-top:28px;font-size:13px;color:#6b5e52;">
        Questions? Call us at ${PHONE} — we're here for you.
      </p>
    </div>
    <div style="padding:14px 24px;font-size:12px;color:#8a7a6c;border-top:1px solid #efe6db;">
      ${COMPANY} · Client Services
    </div>
  </div>
</body></html>`
}

function textOf(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function greeting(f: JourneyMergeFields): string {
  const who = f.parentName?.trim() || 'there'
  return `Hi ${who},`
}

function child(f: JourneyMergeFields): string {
  return f.childFirstName.trim() || 'your child'
}

const RENDERERS: Partial<
  Record<CommTemplate, (f: JourneyMergeFields) => { subject: string; body: string }>
> = {
  INQUIRY_ACK: (f) => ({
    subject: `We received your inquiry for ${child(f)} — ${COMPANY}`,
    body: `<p>${greeting(f)}</p>
<p>Thank you for reaching out about ABA services for <strong>${child(f)}</strong>. We've received your inquiry and a member of our intake team will be in touch shortly.</p>
<p>In the meantime, feel free to reply to this email with any questions.</p>`,
  }),
  CONSENT_REQUEST: (f) => ({
    subject: `Consent forms for ${child(f)} — next step`,
    body: `<p>${greeting(f)}</p>
<p>We're ready for the next step in ${child(f)}'s journey. Please review and complete the consent forms so we can continue intake.</p>
<p>Your case coordinator${f.coordinatorName ? ` (${f.coordinatorName})` : ''} is available if you need help.</p>`,
  }),
  DOCS_NEEDED: (f) => ({
    subject: `Documents needed for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>To keep ${child(f)}'s intake moving, we still need a few documents (insurance card, diagnostic evaluation, and related items).</p>
<p>You can reply to this email with attachments or ask us how to upload securely.</p>`,
  }),
  BENEFITS_UPDATE: (f) => ({
    subject: `Benefits update for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>We're verifying insurance benefits for ${child(f)} and will share an update once eligibility is confirmed.</p>
<p>No action is needed from you right now unless we reach out for additional information.</p>`,
  }),
  ASSESSMENT_SCHEDULED: (f) => ({
    subject: `Assessment scheduled for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>An assessment has been scheduled for ${child(f)}${f.assessmentDate ? ` on <strong>${f.assessmentDate}</strong>` : ''}.</p>
<p>We'll confirm details and what to expect before the visit. Please let us know if you need to reschedule.</p>`,
  }),
  AUTH_APPROVED: (f) => ({
    subject: `Authorization approved for ${child(f)} — great news`,
    body: `<p>${greeting(f)}</p>
<p>Good news: authorization for ${child(f)}'s ABA services has been approved. Our staffing team will begin matching a therapist next.</p>`,
  }),
  READY_FOR_STAFFING: (f) => ({
    subject: `Finding the right therapist for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>${child(f)} is ready for staffing. We're matching an RBT who fits your schedule and preferences — we'll update you as soon as we have a match.</p>`,
  }),
  RBT_ASSIGNED: (f) => ({
    subject: `Meet ${f.rbtName || 'your RBT'} — assigned for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>We're pleased to share that ${f.rbtName ? `<strong>${f.rbtName}</strong> has` : 'an RBT has'} been assigned to work with ${child(f)}.</p>
<p>Next we'll coordinate a schedule that works for your family.</p>`,
  }),
  SCHEDULE_CONFIRMED: (f) => ({
    subject: `Schedule confirmed for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>${child(f)}'s therapy schedule is confirmed${f.startDate ? `. Planned start: <strong>${f.startDate}</strong>` : ''}.</p>
<p>Please reply if anything needs adjusting before services begin.</p>`,
  }),
  SERVICES_STARTED: (f) => ({
    subject: `Services have started for ${child(f)}`,
    body: `<p>${greeting(f)}</p>
<p>We're excited to share that ABA services for ${child(f)} are underway${f.startDate ? ` as of <strong>${f.startDate}</strong>` : ''}.</p>
<p>Your care team is here for you — reach out anytime with questions or feedback.</p>`,
  }),
}

export function renderJourneyEmail(
  template: CommTemplate,
  fields: Partial<JourneyMergeFields> & {
    childFirstName: string
    childLastName: string
  }
): RenderedJourneyEmail | null {
  const renderer = RENDERERS[template]
  if (!renderer) return null

  const f: JourneyMergeFields = {
    childFirstName: fields.childFirstName,
    childLastName: fields.childLastName,
    parentName: fields.parentName ?? null,
    coordinatorName: fields.coordinatorName ?? null,
    coordinatorEmail: fields.coordinatorEmail ?? null,
    rbtName: fields.rbtName ?? null,
    startDate: fields.startDate ?? null,
    assessmentDate: fields.assessmentDate ?? null,
    companyPhone: fields.companyPhone ?? PHONE,
    companyName: fields.companyName ?? COMPANY,
  }

  const { subject, body } = renderer(f)
  const html = wrap(body)
  return { template, subject, html, text: textOf(html) }
}

export function journeyTemplateLabel(template: CommTemplate): string {
  return template.replace(/_/g, ' ').toLowerCase()
}
