import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  ACCENT,
  BODY_TEXT,
  coordinatorSignature,
  dearGreeting,
  officePhone,
  para,
  sectionRule,
} from './shell'
import { childName } from './helpers'

/** Fallback list when the CRM has no open requirement rows yet. */
export const DEFAULT_MISSING_DOCS_COPY = [
  'Insurance card — front and back',
  'Medicaid card, if applicable — front and back',
  'Diagnostic evaluation report (DSM-5 / autism diagnosis)',
  'Physician referral or prescription for ABA',
  'IEP or IFSP, if applicable',
  'Custody or guardianship order, if applicable',
  'Prior ABA records, if applicable',
  'Completed Client Intake Form (Form 01)',
  'Signed Consent & Authorization Form (Form 02)',
]

export function missingDocsListHtml(
  fields: StaffMergeFields,
  heading = 'Outstanding documents'
): string {
  const items =
    fields.missingDocsList.length > 0
      ? fields.missingDocsList
      : DEFAULT_MISSING_DOCS_COPY
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.5;color:${BODY_TEXT};">${item}</li>`
    )
    .join('')
  return `${sectionRule(heading)}
<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;">${lis}</ul>`
}

/** Follow-up nudge when documents/forms are still outstanding after the welcome packet. */
export function renderDocsNeeded(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)

  return {
    subject: `Friendly reminder — documents still needed for ${child}`,
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`We&apos;re checking in with a <strong>gentle reminder</strong>. We previously sent ${child}&apos;s welcome packet with the intake forms and document checklist, and we don&apos;t want anything to hold up progress toward starting services.`)}
      ${para(`To keep moving forward, we still need the following from you:`)}
      ${missingDocsListHtml(fields)}
      ${para(`As soon as we have these, we can continue verifying insurance and requesting the approvals ${child} needs — <strong style="color:${ACCENT};">the sooner these come in, the sooner we can keep things moving</strong> on our end.`)}
      ${para(`Please reply to this email with the completed forms and documents attached, or call us if you need help gathering anything.`)}
      ${para(`If any of these are hard to get — a referral missing a required detail, an evaluation you&apos;re still waiting on — please call us at <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a>. This is common, it&apos;s fixable, and we&apos;ll tell you exactly what to ask for.`)}
      ${coordinatorSignature(fields)}
    `,
  }
}
