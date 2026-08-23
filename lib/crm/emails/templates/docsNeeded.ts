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
      ${para(`Thank you for completing the consent forms — that helps us move forward with ${child}&apos;s care.`)}
      ${para(`To keep intake on track, we still need a few documents from you. Please send what you have available; if something is missing, let us know and we can help.`)}
      ${infoBlock('Documents to send', [
        '<strong>Intake form</strong> (we can provide this if you need a copy)',
        '<strong>Transfer letter</strong> (if coming from another provider)',
        'Diagnostic evaluation / psychological evaluation',
        'Physician referral / prescription',
        'Insurance card (front and back)',
        'Parent / guardian photo ID',
        'IEP (if applicable)',
      ])}
      ${ctaButton('Reply with documents', reply)}
      ${para(`You can reply to this email with attachments. If you have already sent some items, thank you — just send what is still outstanding.`)}
      ${staffSignature(fields)}
    `,
  }
}
