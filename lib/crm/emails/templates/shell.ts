export const COMPANY_NAME = 'Rise & Shine ABA'
export const COMPANY_PHONE = '(888) 898-4774'
export const COMPANY_EMAIL = 'info@riseandshineaba.com'

/** Absolute HTTPS URL — email clients cannot load relative or localhost images. */
export const EMAIL_LOGO_URL = 'https://www.riseandshinehrm.com/new-real-logo.png'
const LOGO_URL = EMAIL_LOGO_URL

/** Branded HTML shell — sunrise header, blue info blocks, espresso text. */
export function wrapStaffEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${COMPANY_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#fff4e8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#2f2318;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4e8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8ddd0;box-shadow:0 2px 8px rgba(47,35,24,0.06);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#ffa94d 0%,#f2652a 50%,#e7692c 100%);text-align:center;">
              <img src="${LOGO_URL}" alt="${COMPANY_NAME}" width="180" style="display:block;margin:0 auto 12px;max-width:180px;height:auto;" />
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">${COMPANY_NAME}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.92);margin-top:6px;">Supporting your family every step of the way</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#2f2318;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f7f3ee;border-top:1px solid #e8ddd0;font-size:13px;color:#6b5e52;line-height:1.5;">
              <strong style="color:#2f2318;">${COMPANY_NAME}</strong><br />
              ${COMPANY_EMAIL} · ${COMPANY_PHONE}<br />
              <span style="font-size:12px;color:#8a7a6c;">Client Services · Confidential family communication</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Blue callout block for lists and next steps. */
export function infoBlock(title: string, items: string[]): string {
  const lis = items.map((i) => `<li style="margin-bottom:8px;">${i}</li>`).join('')
  return `<div style="margin:20px 0;padding:18px 20px;background:#eef6ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;">
    <div style="font-weight:600;color:#1e40af;margin-bottom:10px;">${title}</div>
    <ul style="margin:0;padding-left:20px;color:#1e3a5f;">${lis}</ul>
  </div>`
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

export function greeting(fields: { parentName: string | null }): string {
  const who = fields.parentName?.trim() || 'there'
  return `Hi ${who},`
}

export function childName(fields: {
  childFirstName: string
}): string {
  return fields.childFirstName.trim() || 'your child'
}

export function staffSignature(fields: {
  staffName: string
  staffEmail: string | null
}): string {
  const lines = [`Warm regards,`, `<strong>${fields.staffName}</strong>`, COMPANY_NAME]
  if (fields.staffEmail) {
    lines.push(`<a href="mailto:${fields.staffEmail}" style="color:#e7692c;">${fields.staffEmail}</a>`)
  }
  return `<p style="margin-top:28px;font-size:14px;color:#2f2318;line-height:1.5;">${lines.join('<br />')}</p>`
}
