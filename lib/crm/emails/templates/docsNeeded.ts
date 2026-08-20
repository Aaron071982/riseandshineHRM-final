import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  childName,
  ctaButton,
  greeting,
  infoBlock,
  para,
  staffSignature,
} from './shell'

export function renderDocsNeeded(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const reply = `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Documents for ${child}`)}`
  return {
    subject: `Documents we need for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`Thank you for choosing <strong>Rise &amp; Shine ABA</strong>. To keep ${child}’s intake moving, we still need a few documents from you.`)}
      ${infoBlock('Please send when you can', [
        'Parent consent form',
        'Family packet',
        'Intake form',
        'Insurance card (front and back)',
        'Parent / guardian photo ID',
        'IEP / IFSP (if available)',
        'DSM-5 checklist',
        'Psychological evaluation / autism diagnosis',
        'Transfer letter (if coming from another provider)',
        'Doctor’s referral / prescription',
      ])}
      ${ctaButton('Reply with documents', reply)}
      ${para(`You can reply to this email with attachments, or tell us if you need a secure upload option. If you’ve already sent some items, thank you — just send what’s still outstanding.`)}
      ${staffSignature(fields)}
    `,
  }
}
