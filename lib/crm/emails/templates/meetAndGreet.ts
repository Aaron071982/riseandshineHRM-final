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
import { contactBlock, formatClientAddress, formatRbtAddress } from './helpers'

export function renderMeetAndGreet(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const clientAddr = formatClientAddress(fields)

  const clientBlock = contactBlock(`${child} — contact & location`, [
    { label: 'Name', value: `${fields.childFirstName} ${fields.childLastName}`.trim() },
    { label: 'Phone', value: fields.parentPhone },
    { label: 'Address', value: clientAddr },
  ])

  const rbtBlock = fields.rbtName
    ? contactBlock(`RBT — ${fields.rbtName}`, [
        { label: 'Name', value: fields.rbtName },
        { label: 'Phone', value: fields.rbtPhone },
        { label: 'Email', value: fields.rbtEmail },
        { label: 'Address', value: formatRbtAddress(fields) },
      ])
    : ''

  const bcbaBlock = fields.bcbaName
    ? contactBlock(`BCBA — ${fields.bcbaName}`, [
        { label: 'Name', value: fields.bcbaName },
        { label: 'Phone', value: fields.bcbaPhone },
        { label: 'Email', value: fields.bcbaEmail },
      ])
    : ''

  return {
    subject: `Meet and Greet for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`We would like to schedule a meet and greet so you can connect with ${child}&apos;s care team before services begin. This is an opportunity to ask questions and make sure everyone feels comfortable.`)}
      ${infoBlock('Your care team', [
        'Below is contact information for your family and clinical team.',
        'Please reply with a few times that work this week, and we will confirm.',
      ])}
      ${clientBlock}
      ${rbtBlock}
      ${bcbaBlock}
      ${ctaButton('Share your availability', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Meet and Greet for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
