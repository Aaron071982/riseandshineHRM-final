import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  childName,
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
      ${para(`If you need to adjust a day or time, contact us using the information below so we can update coverage.`)}
      ${staffSignature(fields)}
    `,
  }
}
