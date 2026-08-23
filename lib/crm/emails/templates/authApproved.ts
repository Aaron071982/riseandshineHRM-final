import type { StaffEmailContent, StaffMergeFields } from './types'
import { childName, greeting, para, staffSignature } from './shell'

export function renderAuthApproved(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  return {
    subject: `Authorization approved for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`Good news — authorization for ${child}&apos;s ABA services has been approved.`)}
      ${para(`Our staffing and coordination teams will take the next steps and keep you updated as we match a therapist and confirm scheduling.`)}
      ${staffSignature(fields)}
    `,
  }
}
