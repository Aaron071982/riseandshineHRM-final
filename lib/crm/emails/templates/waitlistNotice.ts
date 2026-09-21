import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  dearGreeting,
  officeEmail,
  officePhone,
  para,
  teamSignature,
} from './shell'
import { childName } from './helpers'

/**
 * Sole parent email for families on the WAITLIST stage.
 * Explains they are parked until we can offer services — no action items.
 */
export function renderWaitlistNotice(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject: `Update on ${child}'s inquiry — placed on our waitlist`,
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`Thank you for reaching out to Rise &amp; Shine ABA about care for <strong>${child}</strong>. We truly appreciate your interest in our services and the trust you place in us.`)}
      ${para(`At this time, we are not able to begin the intake process or offer services for ${child}. We have placed your family on our <strong>waitlist</strong> so we can follow up as soon as our capacity and circumstances allow us to serve you.`)}
      ${para(`This does not mean we are declining your inquiry permanently. It means we want to be transparent: we cannot take meaningful next steps right now, and we will not ask you to complete forms or gather documents until we are in a position to move forward.`)}
      ${para(`When an opening becomes available, a member of our intake team will contact you using the information you provided. There is nothing you need to do in the meantime.`)}
      ${para(`If your circumstances change, or if you would like to withdraw from the waitlist, please reply to this message or contact us at <a href="tel:+18888984774" style="color:#e7692c;text-decoration:none;">${phone}</a> or <a href="mailto:${email}" style="color:#e7692c;text-decoration:none;">${email}</a>.`)}
      ${para(`Thank you again for considering Rise &amp; Shine. We look forward to the opportunity to support your family when we can.`)}
      ${teamSignature()}
    `,
  }
}
