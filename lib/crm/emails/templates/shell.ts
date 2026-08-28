import type { CommTemplate } from '@prisma/client'
import { progressionTimelineForTemplate } from './milestones'

export const COMPANY_NAME = 'Rise & Shine ABA'
export const COMPANY_PHONE = '888-898-4774'
export const COMPANY_PHONE_DISPLAY = '(888) 898-4774'
export const COMPANY_EMAIL = 'info@riseandshineaba.com'

/** Absolute HTTPS URL — renders in Gmail, Outlook, Apple Mail. */
export const EMAIL_LOGO_URL =
  'https://www.riseandshinehrm.com/api/public/email-logo'

/** Single body text color — no two-tone copy blocks. */
export const BODY_TEXT = '#2f2318'
export const MUTED_TEXT = '#6b5e52'
export const ACCENT = '#f2652a'
export const RULE = '#ebe3da'

export type EmailAttachmentMeta = {
  fileName: string
  sizeBytes: number
}

export type EmailLinkMeta = {
  url: string
  label?: string
}

export type WrapStaffEmailOptions = {
  attachments?: EmailAttachmentMeta[]
  links?: EmailLinkMeta[]
  /** When set, inserts the parent journey timeline under the logo/header. */
  template?: CommTemplate
  /** Ops / internal digests — no journey timeline, quieter footer. */
  internal?: boolean
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Thin accent rule — the only section color besides logo + button. */
export function sectionRule(label?: string): string {
  const title = label
    ? `<div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};margin:0 0 10px;">${escapeHtml(label)}</div>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 14px;">
  <tr><td style="border-top:1px solid ${RULE};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
  ${title ? `<tr><td style="padding-top:14px;">${title}</td></tr>` : ''}
</table>`
}

function attachmentsStrip(attachments: EmailAttachmentMeta[] | undefined): string {
  if (!attachments?.length) return ''
  const rows = attachments
    .map((a) => {
      const size = formatFileSize(a.sizeBytes)
      return `<tr>
        <td style="padding:4px 0;font-size:14px;color:${BODY_TEXT};">
          ${escapeHtml(a.fileName)}${size ? ` <span style="color:${MUTED_TEXT};">(${size})</span>` : ''}
        </td>
      </tr>`
    })
    .join('')
  return `
    ${sectionRule('Attached files')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
}

function linksStrip(links: EmailLinkMeta[] | undefined): string {
  if (!links?.length) return ''
  // When the body already includes a primary CTA for the first link, still list extras.
  const buttons = links
    .map((l) => {
      const label = l.label?.trim() || 'Open link'
      const href = l.url.trim()
      return `<tr><td style="padding:6px 0;">${ctaButtonInner(label, href)}</td></tr>`
    })
    .join('')
  return `
    ${sectionRule('Downloads & links')}
    <table role="presentation" cellpadding="0" cellspacing="0">${buttons}</table>`
}

function ctaButtonInner(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" bgcolor="${ACCENT}" style="border-radius:8px;background:${ACCENT};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;line-height:1.2;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`
}

/** Branded HTML shell — logo + accent bar + white body; no two-tone copy blocks. */
export function wrapStaffEmail(
  bodyHtml: string,
  options?: WrapStaffEmailOptions
): string {
  const attachHtml = attachmentsStrip(options?.attachments)
  const linkHtml = ''
  const timelineHtml =
    !options?.internal && options?.template
      ? progressionTimelineForTemplate(options.template)
      : ''
  const footerNote = options?.internal
    ? 'Internal operations summary — not for forwarding to families.'
    : 'Confidential family communication — please do not forward without permission.'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>${COMPANY_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#faf6f1;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:${BODY_TEXT};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${RULE};box-shadow:0 1px 3px rgba(47,35,24,0.06);">
          <tr>
            <td style="height:3px;line-height:3px;font-size:0;background:${ACCENT};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 40px 24px;text-align:left;border-bottom:1px solid ${RULE};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:72px;padding-right:16px;">
                    <img src="${EMAIL_LOGO_URL}" alt="${COMPANY_NAME}" width="64" height="64" style="display:block;width:64px;height:64px;border:0;outline:none;text-decoration:none;border-radius:12px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:20px;font-weight:700;color:${BODY_TEXT};letter-spacing:-0.02em;line-height:1.2;">${COMPANY_NAME}</div>
                    <div style="font-size:13px;color:${MUTED_TEXT};margin-top:5px;line-height:1.4;">Supporting your family every step of the way</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${timelineHtml}
          <tr>
            <td style="padding:28px 40px 36px;font-size:15px;line-height:1.65;color:${BODY_TEXT};background:#ffffff;">
              ${bodyHtml}
              ${attachHtml}
              ${linkHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 40px;border-top:1px solid ${RULE};font-size:13px;color:${MUTED_TEXT};line-height:1.55;background:#ffffff;">
              <strong style="color:${BODY_TEXT};">${COMPANY_NAME}</strong><br />
              <a href="mailto:${COMPANY_EMAIL}" style="color:${ACCENT};text-decoration:none;">${COMPANY_EMAIL}</a>
              &nbsp;·&nbsp;
              <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${COMPANY_PHONE_DISPLAY}</a><br />
              <span style="font-size:12px;color:${MUTED_TEXT};margin-top:6px;display:inline-block;">${footerNote}</span>
            </td>
          </tr>
        </table>
        <div style="max-width:700px;margin:16px auto 0;font-size:11px;color:#a89888;line-height:1.4;text-align:center;">
          Rise &amp; Shine ABA Client Services
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Simple titled list on white — no cream/tinted panels (v1 brand rule).
 */
export function infoBlock(title: string, items: string[]): string {
  const lis = items
    .map(
      (i) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.5;color:${BODY_TEXT};">${i}</li>`
    )
    .join('')
  return `${sectionRule(title)}
<ul style="margin:0;padding-left:20px;color:${BODY_TEXT};font-size:14px;">${lis}</ul>`
}

/** Numbered list on white. */
export function numberedList(items: string[]): string {
  const lis = items
    .map(
      (i) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.5;color:${BODY_TEXT};">${i}</li>`
    )
    .join('')
  return `<ol style="margin:0 0 16px;padding-left:22px;color:${BODY_TEXT};font-size:14px;">${lis}</ol>`
}

/** Primary CTA — solid accent button (Outlook-safe table). */
export function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
  <tr>
    <td align="left">${ctaButtonInner(label, href)}</td>
  </tr>
</table>`
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Prefer parent first name; fall back to "there" — never "Hi ,". */
export function parentFirstNameFromFull(
  parentName: string | null | undefined
): string | null {
  const raw = parentName?.trim()
  if (!raw) return null
  const first = raw.split(/\s+/)[0]?.replace(/[^a-zA-Z'-]/g, '') ?? ''
  return first || null
}

export function greeting(fields: {
  parentName?: string | null
  parentFirstName?: string | null
}): string {
  const first =
    fields.parentFirstName?.trim() ||
    parentFirstNameFromFull(fields.parentName ?? null)
  return first ? `Hi ${first},` : 'Hi there,'
}

/** v1 voice: "Dear {{parentName}}," */
export function dearGreeting(fields: {
  parentName?: string | null
  parentFirstName?: string | null
}): string {
  const full = fields.parentName?.trim()
  if (full) return `Dear ${escapeHtml(full)},`
  const first =
    fields.parentFirstName?.trim() ||
    parentFirstNameFromFull(fields.parentName ?? null)
  return first ? `Dear ${escapeHtml(first)},` : 'Dear Parent/Guardian,'
}

export function staffSignature(fields: {
  staffName: string
  staffEmail: string | null
}): string {
  const lines = [
    'Warm regards,',
    `<strong>${escapeHtml(fields.staffName)}</strong>`,
    COMPANY_NAME,
  ]
  if (fields.staffEmail) {
    lines.push(
      `<a href="mailto:${escapeHtml(fields.staffEmail)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(fields.staffEmail)}</a>`
    )
  }
  return `<p style="margin:28px 0 0;font-size:14px;color:${BODY_TEXT};line-height:1.55;">${lines.join('<br />')}</p>`
}

/** Welcome packet closing. */
export function teamSignature(): string {
  return `<p style="margin:28px 0 0;font-size:14px;color:${BODY_TEXT};line-height:1.55;">With warmth and dedication,<br /><strong>The Rise &amp; Shine ABA Team</strong></p>`
}

/** Coordinator closing for intake / nudge emails. */
export function coordinatorSignature(fields: {
  coordinatorName?: string | null
  coordinatorTitle?: string | null
  staffName?: string
  companyPhone?: string
}): string {
  const name =
    fields.coordinatorName?.trim() ||
    fields.staffName?.trim() ||
    'The Rise & Shine ABA Team'
  const title = fields.coordinatorTitle?.trim() || 'Case Coordinator'
  const phone = fields.companyPhone?.trim() || COMPANY_PHONE_DISPLAY
  return `<p style="margin:28px 0 0;font-size:14px;color:${BODY_TEXT};line-height:1.55;">Warmly,<br /><strong>${escapeHtml(name)}</strong>, ${escapeHtml(title)}<br />Rise &amp; Shine ABA · ${escapeHtml(phone)}</p>`
}

export function officePhone(fields: { companyPhone?: string }): string {
  return fields.companyPhone?.trim() || COMPANY_PHONE_DISPLAY
}

export function officeEmail(fields: { companyEmail?: string }): string {
  return fields.companyEmail?.trim() || COMPANY_EMAIL
}

export function para(html: string): string {
  return `<p style="margin:0 0 16px;color:${BODY_TEXT};">${html}</p>`
}

export function portalCta(
  _portalLink: string | null | undefined,
  _label = 'Open your secure portal'
): string {
  return para(
    `Please contact us using the phone number and email in the footer below if you need help sending documents securely.`
  )
}

export { childName, childInitialLast } from './helpers'
