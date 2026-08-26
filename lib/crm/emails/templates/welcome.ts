import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  dearGreeting,
  officeEmail,
  officePhone,
  para,
  teamSignature,
} from './shell'
import { childName } from './helpers'

export function renderWelcome(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject: "Welcome to Rise & Shine ABA — here's what happens next",
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`Welcome to Rise &amp; Shine ABA, and thank you for trusting us with <strong>${child}</strong>&apos;s care. Choosing an ABA provider is a real decision, and we&apos;re grateful you&apos;ve chosen us to walk alongside your family.`)}
      ${para(`We&apos;ve included your <strong>Parent Welcome Packet</strong> with this email — use the orange <strong>Download Welcome Packet</strong> button below (and check your email attachments). Please take a few minutes to read it when you have the chance — it explains, in plain language, exactly how ABA services work, who will be part of ${child}&apos;s team, and the step-by-step journey from today through your child&apos;s first session. There are no surprises hidden in it, and nothing you&apos;ll be expected to already know.`)}
      ${para(`One thing we want to say clearly right from the start: much of how quickly ${child} can begin depends on your insurance company, not on us. We will be honest with you at every stage about where things stand — including the times when the delay is on the insurer&apos;s side and there is genuinely nothing further we can do to speed it up. You will never be left wondering.`)}
      ${para(`In the next day or two, you&apos;ll receive a second email from us with your <strong>Intake and Consent forms</strong> attached. Please complete those forms and return them by email as directed in that message — getting them back complete and accurate the first time is the single biggest thing you can do to help ${child} start sooner.`)}
      ${para(`If any question comes up before then, please don&apos;t hesitate to call us at <a href="tel:+18888984774" style="color:#f2652a;text-decoration:none;">${phone}</a> or email <a href="mailto:${email}" style="color:#f2652a;text-decoration:none;">${email}</a>. We would always rather answer a question twice than have you worry once.`)}
      ${teamSignature()}
    `,
  }
}
