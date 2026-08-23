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

/**
 * Scheduling intro only — full client/care-team details go on the Meet & Greet form
 * (attached or sent separately), not in this email body.
 */
export function renderMeetAndGreet(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)

  return {
    subject: `Meet and Greet for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`We would like to schedule a short meet and greet so you can connect with ${child}&apos;s care team before services begin. This is a chance to ask questions and make sure everyone feels comfortable.`)}
      ${infoBlock('What happens next', [
        'Reply with a few times that work this week, and we will confirm.',
        'You will receive a Meet &amp; Greet form with care-team and family details — please complete and return that form separately.',
      ])}
      ${ctaButton('Share your availability', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Meet and Greet for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
