import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  childName,
  greeting,
  para,
  staffSignature,
} from './shell'

export function renderConsentRequest(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const contact = fields.staffEmail || COMPANY_EMAIL

  return {
    subject: `Consent forms for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`Thank you for choosing Rise &amp; Shine ABA. We are preparing to move forward with services for ${child}, and the next step is to complete our consent paperwork.`)}
      ${para(`We have included a secure link in this email where you can review and submit the consent form. The form covers how we deliver services, how we may contact you, and other standard intake authorizations. Completing it allows our team to continue coordinating care and scheduling without delay.`)}
      ${para(`<strong>Please open the link below and submit the consent form when you are ready so we can begin.</strong> If you have any trouble opening the link, reply to this message and we will resend it or walk you through the steps.`)}
      ${para(`Most families finish in just a few minutes. Once we receive your signed consent, we will confirm receipt and keep you updated on the next steps in ${child}&apos;s intake process.`)}
      ${para(`If you prefer to discuss the form by phone before signing, call us at ${COMPANY_PHONE} or email <a href="mailto:${contact}" style="color:#c45a1a;text-decoration:none;">${contact}</a> — we are happy to answer any questions.`)}
      ${para(`We appreciate your partnership and look forward to supporting your family.`)}
      ${staffSignature(fields)}
    `,
  }
}
