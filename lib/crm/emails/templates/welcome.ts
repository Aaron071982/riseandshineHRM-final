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

export function renderWelcome(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const reply = `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Question about ${child}`)}`
  return {
    subject: `Welcome to Rise & Shine ABA`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`Welcome to <strong>Rise &amp; Shine ABA</strong>. We’re glad you’re here, and we’re ready to walk with you and ${child} through each step of getting started.`)}
      ${para(`Here’s what to expect next — we’ll keep things clear and move at a pace that works for your family.`)}
      ${infoBlock('What happens next', [
        'We’ll share consent forms for you to review and sign.',
        'Send insurance cards, evaluations, and any related records you already have.',
        'We verify benefits and submit authorization to your insurance.',
        `We match ${child} with a clinical team and therapist who fit your schedule.`,
        'We confirm the schedule and start date with you before services begin.',
      ])}
      ${ctaButton('Reply with questions', reply)}
      ${para(`If anything feels unclear, just reply — we’re happy to help.`)}
      ${staffSignature(fields)}
    `,
  }
}
