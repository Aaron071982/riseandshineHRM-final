import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  childName,
  ctaButton,
  greeting,
  infoBlock,
  para,
  staffSignature,
} from './shell'
import { childInitialLast } from './helpers'

export function renderRbtAssigned(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const c = childInitialLast(fields)
  const rbt = fields.rbtName?.trim()
  const who = rbt ? `<strong>${rbt}</strong>` : 'A therapist on our team'

  const contactLines: string[] = []
  if (fields.rbtPhone?.trim()) {
    contactLines.push(`Phone: <strong>${fields.rbtPhone.trim()}</strong>`)
  }
  if (fields.rbtEmail?.trim()) {
    contactLines.push(
      `Email: <a href="mailto:${fields.rbtEmail.trim()}" style="color:#c45a1a;text-decoration:none;">${fields.rbtEmail.trim()}</a>`
    )
  }

  return {
    subject: rbt ? `Meet ${rbt} — therapist for ${child}` : `Therapist assigned for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`We have great news — ${who} has been assigned to work with ${child}. We chose this match carefully based on your family&apos;s needs and schedule.`)}
      ${para(`At this stage, your therapist is matched to ${c}&apos;s case. We will coordinate scheduling and a meet-and-greet so you can connect before sessions begin.`)}
      ${
        contactLines.length
          ? infoBlock(`${rbt ?? 'Your therapist'} — contact info`, contactLines)
          : para(`We will share your therapist&apos;s contact details shortly.`)
      }
      ${para(`If you have scheduling questions in the meantime, reply to this email or call us at ${COMPANY_PHONE}.`)}
      ${ctaButton('Reply with questions', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Therapist for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
