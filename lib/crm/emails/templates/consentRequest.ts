import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  ACCENT,
  coordinatorSignature,
  dearGreeting,
  infoBlock,
  officeEmail,
  officePhone,
  para,
  sectionRule,
} from './shell'
import { childName } from './helpers'

export function renderConsentRequest(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject: 'Your next step with Rise & Shine — intake, consent, and documents',
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`Now that ${child} is set up in our system, here is the next step — and it&apos;s the one that&apos;s genuinely in your hands. Completing it thoroughly is what lets us move everything else forward.`)}
      ${para(`Please complete both forms below and email the finished copies back to us (reply to this message or send them to <a href="mailto:${email}" style="color:${ACCENT};text-decoration:none;">${email}</a>). If the blank forms are not attached to this email, reply and we&apos;ll send them right away.`)}
      ${infoBlock('Forms to complete', [
        `The <strong>Client Intake Form (Form 01)</strong> — this gives us everything we need to verify ${child}&apos;s insurance and request authorization for services.`,
        `The <strong>Consent &amp; Authorization Form (Form 02)</strong> — this gives us your permission to assess and treat ${child}, and to share with your insurance only what they require in order to pay for that care. You consent to each item separately; nothing in it is all-or-nothing.`,
      ])}
      ${sectionRule()}
      ${para(`<strong>When you reply, attach the completed forms</strong> (and any supporting documents you have ready). For example:`)}
      ${para(`Insurance card (front and back), Medicaid card if applicable, diagnostic evaluation, physician referral for ABA, IEP/IFSP if ${child} has one, custody paperwork if applicable, and any prior ABA records.`)}
      ${para(`We can&apos;t begin verifying insurance without the insurance card, and we can&apos;t request authorization without the diagnostic evaluation and physician referral — so those are the ones to prioritize if you&apos;re gathering things piece by piece. Send whatever you have now; you can always follow up with the rest.`)}
      ${para(`If a question doesn&apos;t apply to ${child}, just write &quot;N/A&quot; rather than leaving it blank — a blank answer slows us down because we can&apos;t tell &quot;doesn&apos;t apply&quot; from &quot;forgot.&quot; And please copy names and ID numbers exactly as they appear on the insurance card; a single wrong character can hold up approval by weeks.`)}
      ${para(`If anything is unclear, call us at <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a> before you sign — we&apos;d much rather explain it twice.`)}
      ${coordinatorSignature(fields)}
    `,
  }
}
