import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  childName,
  ctaButton,
  greeting,
  para,
  staffSignature,
} from './shell'

export function renderCcIntroduction(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const coordinator =
    fields.coordinatorName?.trim() || fields.staffName || 'your case coordinator'
  const coordinatorEmail =
    fields.coordinatorEmail?.trim() || fields.staffEmail || COMPANY_EMAIL

  return {
    subject: `Your case coordinator — ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`I wanted to introduce myself — I&apos;m <strong>${coordinator}</strong>, and I&apos;ll be your case coordinator throughout ${child}&apos;s time with Rise &amp; Shine ABA.`)}
      ${para(`Think of me as your first point of contact for anything about ${child}, scheduling, services, or questions along the way. You can reach out to me directly anytime — no need to wonder who to email.`)}
      ${para(`<strong>${coordinator}</strong><br />
        <a href="mailto:${coordinatorEmail}" style="color:#c45a1a;text-decoration:none;">${coordinatorEmail}</a><br />
        Company line: <a href="tel:+18888984774" style="color:#c45a1a;text-decoration:none;">${COMPANY_PHONE}</a>`)}
      ${para(`I look forward to working with your family. Reply anytime — I&apos;m here to help.`)}
      ${ctaButton('Email your coordinator', `mailto:${coordinatorEmail}?subject=${encodeURIComponent(`Question about ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
