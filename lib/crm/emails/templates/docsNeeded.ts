import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  ACCENT,
  coordinatorSignature,
  dearGreeting,
  officePhone,
  para,
  portalCta,
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
]

function missingDocsHtml(fields: StaffMergeFields): string {
  const items =
    fields.missingDocsList.length > 0
      ? fields.missingDocsList
      : DEFAULT_MISSING_DOCS_COPY
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.5;color:#2f2318;">${item}</li>`
    )
    .join('')
  return `${sectionRule('Outstanding documents')}
<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;">${lis}</ul>`
}

export function renderDocsNeeded(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)

  return {
    subject: `One step left so we can keep ${child}'s services moving`,
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`We&apos;re writing with a gentle reminder, because we don&apos;t want anything to hold up ${child}&apos;s progress toward starting services.`)}
      ${para(`To continue moving forward, we still need a few documents from you. Right now, these are the items outstanding:`)}
      ${missingDocsHtml(fields)}
      ${para(`As soon as we have them, we can carry on with verifying insurance and requesting the approvals ${child} needs — so the sooner these come in, the sooner we can keep things moving on our end.`)}
      ${para(`Please upload them securely here:`)}
      ${portalCta(fields.portalLink, 'Upload documents securely')}
      ${para(`Please don&apos;t send documents or photos of insurance cards by text or standard email — neither is encrypted. The secure link above is the safe place for all of it. If you&apos;ve already sent something another way, just let us know and we&apos;ll move it into the protected record for you.`)}
      ${para(`If any of these are hard to get hold of — a referral that&apos;s missing a required detail, an evaluation you&apos;re still waiting on — please call us at <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a>. This is common, it&apos;s fixable, and we&apos;ll tell you exactly what to ask for. You don&apos;t have to sort it out alone.`)}
      ${coordinatorSignature(fields)}
    `,
  }
}
