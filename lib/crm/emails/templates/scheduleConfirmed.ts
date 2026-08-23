import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  childName,
  ctaButton,
  greeting,
  para,
  staffSignature,
} from './shell'
import { scheduleTable } from './helpers'

export function renderScheduleConfirmed(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields)
  const start = fields.startDate
    ? ` Planned start: <strong>${fields.startDate}</strong>.`
    : ''

  return {
    subject: `Schedule confirmed for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`${child}&apos;s therapy schedule is confirmed.${start} Below is your weekly schedule as of today.`)}
      ${scheduleTable(fields.scheduleSlots)}
      ${para(`If you need to adjust a day or time, reply as soon as you can so we can update coverage.`)}
      ${ctaButton('Request a schedule change', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Schedule change for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
