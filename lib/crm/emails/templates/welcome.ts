import type { StaffEmailContent, StaffMergeFields } from './types'
import { childName, greeting, infoBlock, staffSignature } from './shell'

export function renderWelcome(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  return {
    subject: `Welcome to Rise & Shine ABA!`,
    bodyHtml: `
      <p style="margin:0 0 16px;">${greeting(fields)}</p>
      <p style="margin:0 0 16px;">Welcome to <strong>Rise & Shine ABA</strong>! We are so glad you chose us to support ${child} and your family. Our team is here to guide you through each step of getting started with ABA services.</p>
      ${infoBlock('What happens next', [
        'Complete the consent form we will send or share with you.',
        'Send your insurance card, evaluation/diagnosis documents, and any related records.',
        'We verify benefits and submit authorization to your insurance.',
        'We assign your clinical team and match a therapist for ${child}.',
        'We confirm your schedule and service start date with you.',
      ])}
      <p style="margin:16px 0 0;">If you have questions at any point, reply to this email or call us — we are happy to help.</p>
      ${staffSignature(fields)}
    `,
  }
}
