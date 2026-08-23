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
    subject: 'Welcome to Rise & Shine ABA',
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`Welcome to <strong>Rise &amp; Shine ABA</strong>. We are glad you reached out, and we are here to guide your family through each step of getting started with ABA services for ${child}.`)}
      ${para(`We know this process can feel like a lot. Our team will keep things clear, answer your questions, and move at a pace that works for you.`)}
      ${infoBlock('What to expect next', [
        'We will send consent forms for you to review and sign.',
        'We will request a few documents to complete intake.',
        'We verify insurance benefits and work on authorization.',
        'We match your child with a therapist and clinical team.',
        'We confirm scheduling and your start date before services begin.',
      ])}
      ${para(`You do not need to have everything figured out today. Reply anytime if something is unclear — we are happy to help.`)}
      ${ctaButton('Reply with questions', reply)}
      ${staffSignature(fields)}
    `,
  }
}
