import type { StaffEmailContent, StaffMergeFields } from './types'
import { childName, greeting, infoBlock, staffSignature } from './shell'

export function renderDocsNeeded(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  return {
    subject: `Thank you for choosing Rise & Shine ABA`,
    bodyHtml: `
      <p style="margin:0 0 16px;">${greeting(fields)}</p>
      <p style="margin:0 0 16px;">Thank you for choosing <strong>Rise & Shine ABA</strong>! To keep ${child}'s intake moving forward, we need a few documents from you.</p>
      ${infoBlock('Documents needed', [
        'Parent consent form',
        'Family packet',
        'Intake form',
        'Insurance Card (front and back)',
        'Parent / Guardian Photo ID',
        'IEP / IFSP',
        'DSM-5 checklist',
        'Psychological evaluation',
        'Transfer letter (if coming from another company)',
        "Doctor's referral / prescription",
      ])}
      <p style="margin:16px 0 0;">You can reply to this email with attachments or let us know if you need a secure upload option. If you have already sent any of these items, thank you — just send whatever is still outstanding.</p>
      ${staffSignature(fields)}
    `,
  }
}
