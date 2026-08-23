import type { StaffEmailContent, StaffMergeFields } from './types'
import { childName, greeting, para, staffSignature } from './shell'

export function renderBenefitsUpdate(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  return {
    subject: `Benefits update for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`We are verifying insurance benefits for ${child} and will share a clear update once eligibility is confirmed.`)}
      ${para(`No action is needed from you right now unless we reach out for an insurance card or member ID. Thank you for your patience.`)}
      ${staffSignature(fields)}
    `,
  }
}
