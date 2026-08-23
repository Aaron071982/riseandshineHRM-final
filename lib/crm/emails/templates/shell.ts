export const COMPANY_NAME = 'Rise & Shine ABA'
export const COMPANY_PHONE = '(888) 898-4774'
export const COMPANY_EMAIL = 'info@riseandshineaba.com'

/** Absolute HTTPS URL — renders in Gmail, Outlook, Apple Mail. */
export const EMAIL_LOGO_URL =
  'https://www.riseandshinehrm.com/api/public/email-logo'

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

function attachmentsStrip(attachments: EmailAttachmentMeta[] | undefined): string {
  if (!attachments?.length) return ''
  const rows = attachments
    .map((a) => {
      const size = formatFileSize(a.sizeBytes)
      return `<tr>
        <td style="padding:6px 0;font-size:13px;color:#2f2318;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f2652a;margin-right:8px;vertical-align:middle;"></span>
          <strong>${escapeHtml(a.fileName)}</strong>${size ? ` <span style="color:#8a7a6c;">(${size})</span>` : ''}
        </td>
      </tr>`
    })
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td style="padding:14px 16px;background:#fffcf8;border:1px solid #ebe3da;border-radius:10px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a7a6c;margin-bottom:8px;">Attached files</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td>
      </tr>
    </table>`
}

function linksStrip(links: EmailLinkMeta[] | undefined): string {
  if (!links?.length) return ''
  const buttons = links
    .map((l) => {
      const label = l.label?.trim() || 'Open link'
      const href = l.url.trim()
      return `<tr><td style="padding:6px 0;">${ctaButtonInner(label, href)}</td></tr>`
    })
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td style="padding:14px 16px;background:#fff8f2;border:1px solid #f0dcc8;border-radius:10px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a7a6c;margin-bottom:10px;">Links included</div>
          <table role="presentation" cellpadding="0" cellspacing="0">${buttons}</table>
        </td>
      </tr>
    </table>`
}

function ctaButtonInner(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" bgcolor="#f2652a" style="border-radius:8px;background:#f2652a;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;line-height:1.2;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`
}

/** Branded HTML shell — full-width friendly, warm sunrise/espresso palette. */
export function wrapStaffEmail(
  bodyHtml: string,
  options?: WrapStaffEmailOptions
): string {
  const attachHtml = attachmentsStrip(options?.attachments)
  const linkHtml = linksStrip(options?.links)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>${COMPANY_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#faf6f1;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#2f2318;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ebe3da;box-shadow:0 1px 3px rgba(47,35,24,0.06);">
          <tr>
            <td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f2652a 0%,#f5a623 100%);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 40px 24px;text-align:left;border-bottom:1px solid #f0e8df;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:72px;padding-right:16px;">
                    <img src="${EMAIL_LOGO_URL}" alt="${COMPANY_NAME}" width="64" height="64" style="display:block;width:64px;height:64px;border:0;outline:none;text-decoration:none;border-radius:12px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:20px;font-weight:700;color:#2f2318;letter-spacing:-0.02em;line-height:1.2;">${COMPANY_NAME}</div>
                    <div style="font-size:13px;color:#8a7a6c;margin-top:5px;line-height:1.4;">Supporting your family every step of the way</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 40px 36px;font-size:15px;line-height:1.65;color:#2f2318;">
              ${bodyHtml}
              ${attachHtml}
              ${linkHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 40px;background:#f7f3ee;border-top:1px solid #ebe3da;font-size:13px;color:#6b5e52;line-height:1.55;">
              <strong style="color:#2f2318;">${COMPANY_NAME}</strong><br />
              <a href="mailto:${COMPANY_EMAIL}" style="color:#c45a1a;text-decoration:none;">${COMPANY_EMAIL}</a>
              &nbsp;·&nbsp;
              <a href="tel:+18888984774" style="color:#c45a1a;text-decoration:none;">${COMPANY_PHONE}</a><br />
              <span style="font-size:12px;color:#8a7a6c;margin-top:6px;display:inline-block;">Confidential family communication — please do not forward without permission.</span>
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

/** Warm cream callout — sunrise/espresso palette (no blue). */
export function infoBlock(title: string, items: string[]): string {
  const lis = items
    .map(
      (i) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.5;">${i}</li>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr>
    <td style="padding:18px 20px;background:#fff8f2;border-left:4px solid #f2652a;border-radius:0 10px 10px 0;border:1px solid #f0dcc8;border-left:4px solid #f2652a;">
      <div style="font-size:13px;font-weight:700;color:#8b4513;margin:0 0 12px;letter-spacing:0.02em;">${title}</div>
      <ul style="margin:0;padding-left:18px;color:#2f2318;font-size:14px;">${lis}</ul>
    </td>
  </tr>
</table>`
}

/** Primary CTA — solid button (Outlook-safe table). */
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

export function staffSignature(fields: {
  staffName: string
  staffEmail: string | null
}): string {
  const lines = [
    'Warm regards,',
    `<strong>${fields.staffName}</strong>`,
    COMPANY_NAME,
  ]
  if (fields.staffEmail) {
    lines.push(
      `<a href="mailto:${fields.staffEmail}" style="color:#c45a1a;text-decoration:none;">${fields.staffEmail}</a>`
    )
  }
  return `<p style="margin:28px 0 0;font-size:14px;color:#2f2318;line-height:1.55;">${lines.join('<br />')}</p>`
}

export function para(html: string): string {
  return `<p style="margin:0 0 16px;">${html}</p>`
}

export { childName, childInitialLast } from './helpers'
