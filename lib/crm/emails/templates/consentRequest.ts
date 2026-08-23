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

export function renderConsentRequest(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  return {
    subject: `Consent forms for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`We are ready for the next step in ${child}&apos;s journey with Rise &amp; Shine ABA. Please review and sign the consent form so we can continue coordinating care and services.`)}
      ${infoBlock('How to complete consent', [
        'If a consent form is <strong>attached</strong> to this email, open it, complete the highlighted sections, and reply with the signed copy.',
        'If we included a <strong>signing link</strong>, use the button below to sign electronically.',
        'You may also receive a separate signing email from our e-sign provider — either path works.',
        'Once signed, email the form back to us or confirm completion through the link.',
      ])}
      ${para(`Consent confirms how we may deliver services and how you prefer us to reach you (email, phone, or text). If anything is unclear, reply and we will walk you through it.`)}
      ${ctaButton('Reply with questions', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Consent for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
