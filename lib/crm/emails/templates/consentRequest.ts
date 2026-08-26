import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  ACCENT,
  coordinatorSignature,
  dearGreeting,
  infoBlock,
  numberedList,
  officePhone,
  para,
  portalCta,
  sectionRule,
} from './shell'
import { childName } from './helpers'

export function renderConsentRequest(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)

  return {
    subject: 'Your next step with Rise & Shine — intake, consent, and documents',
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`Now that ${child} is set up in our system, here is the next step — and it&apos;s the one that&apos;s genuinely in your hands. Completing it thoroughly is what lets us move everything else forward.`)}
      ${para(`We&apos;ve attached two forms to this email:`)}
      ${infoBlock('Forms attached', [
        `The <strong>Client Intake Form (Form 01)</strong> — this gives us everything we need to verify ${child}&apos;s insurance and request authorization for services.`,
        `The <strong>Consent &amp; Authorization Form (Form 02)</strong> — this gives us your permission to assess and treat ${child}, and to share with your insurance only what they require in order to pay for that care. You consent to each item separately; nothing in it is all-or-nothing.`,
      ])}
      ${sectionRule()}
      ${para(`<strong>Please complete both, and upload them along with your documents, using your secure link:</strong>`)}
      ${portalCta(fields.portalLink, 'Open secure portal')}
      ${para(`For your privacy, please don&apos;t email documents or photos of insurance cards back to us — standard email isn&apos;t encrypted. The secure link above is the safe place for all of it, and everything you upload there goes straight into ${child}&apos;s protected record.`)}
      ${para(`When you open the link, you&apos;ll be able to upload:`)}
      ${numberedList([
        'Insurance card — front <strong>and</strong> back',
        'Medicaid card, if applicable — front and back',
        'Diagnostic evaluation report (the DSM-5 / autism diagnosis)',
        'Physician referral or prescription for ABA',
        `IEP or IFSP, if ${child} has one`,
        'Custody or guardianship order, if applicable',
        `Any prior ABA records, if ${child} has received services before`,
      ])}
      ${para(`We can&apos;t begin verifying insurance without items 1 and 2, and we can&apos;t request authorization without items 3 and 4 — so those four are the ones to prioritize if you&apos;re gathering things piece by piece. Upload whatever you have now; you can always come back and add the rest.`)}
      ${para(`If a question doesn&apos;t apply to ${child}, just write &quot;N/A&quot; rather than leaving it blank — a blank answer slows us down because we can&apos;t tell &quot;doesn&apos;t apply&quot; from &quot;forgot.&quot; And please copy names and ID numbers exactly as they appear on the insurance card; a single wrong character can hold up approval by weeks.`)}
      ${para(`If anything is unclear, call us at <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a> before you sign — we&apos;d much rather explain it twice.`)}
      ${coordinatorSignature(fields)}
    `,
  }
}
