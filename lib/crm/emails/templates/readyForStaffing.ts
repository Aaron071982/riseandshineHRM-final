import type { StaffEmailContent, StaffMergeFields } from './types'
import { childName, greeting, para, staffSignature } from './shell'

export function renderReadyForStaffing(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  return {
    subject: `Finding the right therapist for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`${child} is ready for staffing. We are matching a therapist who fits your schedule, location, and preferences.`)}
      ${para(`We will reach out as soon as we have a strong match. If anything about your availability has changed, reply anytime.`)}
      ${staffSignature(fields)}
    `,
  }
}
