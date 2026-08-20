import type { CommTemplate } from '@prisma/client'
import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  childName,
  ctaButton,
  greeting,
  infoBlock,
  para,
  staffSignature,
} from './shell'

function wrap(
  subject: string,
  fields: StaffMergeFields,
  body: string,
  cta?: { label: string; href: string }
): StaffEmailContent {
  return {
    subject,
    bodyHtml: `
      ${para(greeting(fields))}
      ${body}
      ${cta ? ctaButton(cta.label, cta.href) : ''}
      ${staffSignature(fields)}
    `,
  }
}

export const STUB_RENDERERS: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => StaffEmailContent>
> = {
  CONSENT_REQUEST: (f) => {
    const child = childName(f)
    return wrap(
      `Consent forms for ${child}`,
      f,
      `
      ${para(`We’re ready for the next step in ${child}’s journey. Please review and complete the consent forms so we can continue.`)}
      ${infoBlock('Why this matters', [
        'Consent lets us deliver ABA services and coordinate with your care team.',
        'It also confirms how you’d like us to reach you (email, phone, or text).',
      ])}
      ${para(`If a form is attached to this email, open it, complete the highlighted sections, and reply when you’re done.`)}
      `,
      {
        label: 'Reply when complete',
        href: `mailto:${f.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Consent for ${child}`)}`,
      }
    )
  },

  BENEFITS_UPDATE: (f) => {
    const child = childName(f)
    return wrap(
      `Benefits update for ${child}`,
      f,
      `
      ${para(`We’re verifying insurance benefits for ${child} and will share a clear update once eligibility is confirmed.`)}
      ${para(`No action is needed from you right now unless we reach out for a card or member ID. Thank you for your patience.`)}
      `
    )
  },

  ASSESSMENT_SCHEDULED: (f) => {
    const child = childName(f)
    const when = f.assessmentDate
      ? ` on <strong>${f.assessmentDate}</strong>`
      : ''
    return wrap(
      `Assessment scheduled for ${child}`,
      f,
      `
      ${para(`An assessment has been scheduled for ${child}${when}.`)}
      ${infoBlock('Before the visit', [
        'Have a quiet space ready if the visit is in your home.',
        'Bring any recent evaluations or school documents you want us to see.',
        'Write down questions — we’ll make time for them.',
      ])}
      ${para(`We’ll confirm details with you before the appointment. Reply if you need to reschedule.`)}
      `,
      {
        label: 'Ask a question',
        href: `mailto:${f.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Assessment for ${child}`)}`,
      }
    )
  },

  AUTH_APPROVED: (f) => {
    const child = childName(f)
    return wrap(
      `Authorization approved for ${child}`,
      f,
      `
      ${para(`Good news — authorization for ${child}’s ABA services has been approved.`)}
      ${para(`Our staffing and coordination teams will take the next steps and keep you updated as we match a therapist and confirm scheduling.`)}
      `
    )
  },

  READY_FOR_STAFFING: (f) => {
    const child = childName(f)
    return wrap(
      `Finding the right therapist for ${child}`,
      f,
      `
      ${para(`${child} is ready for staffing. We’re matching a therapist who fits your schedule, location, and preferences.`)}
      ${para(`We’ll reach out as soon as we have a strong match. If anything about your availability has changed, reply anytime.`)}
      `
    )
  },

  RBT_ASSIGNED: (f) => {
    const child = childName(f)
    const who = f.rbtName ? `<strong>${f.rbtName}</strong>` : 'A therapist'
    return wrap(
      f.rbtName
        ? `Meet ${f.rbtName} — assigned for ${child}`
        : `Therapist assigned for ${child}`,
      f,
      `
      ${para(`${who} has been assigned to work with ${child}.`)}
      ${para(`Next we’ll coordinate scheduling and any meet-and-greet so you can feel comfortable before sessions begin.`)}
      `
    )
  },

  SCHEDULE_CONFIRMED: (f) => {
    const child = childName(f)
    const start = f.startDate
      ? ` Planned start: <strong>${f.startDate}</strong>.`
      : ''
    return wrap(
      `Schedule confirmed for ${child}`,
      f,
      `
      ${para(`${child}’s therapy schedule is confirmed.${start}`)}
      ${para(`If you need to adjust a day or time, reply as soon as you can so we can update coverage.`)}
      `
    )
  },

  MEET_AND_GREET: (f) => {
    const child = childName(f)
    return wrap(
      `Meet &amp; greet for ${child}`,
      f,
      `
      ${para(`We’d like to schedule a short meet &amp; greet so you can connect with ${child}’s care team before services begin.`)}
      ${para(`Reply with a few times that work this week, and we’ll confirm.`)}
      `,
      {
        label: 'Share your availability',
        href: `mailto:${f.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Meet & greet for ${child}`)}`,
      }
    )
  },

  CASE_COORDINATION_FORM: (f) => {
    const child = childName(f)
    return wrap(
      `Case coordination forms for ${child}`,
      f,
      `
      ${para(`Please review and complete the case coordination forms so we can finalize ${child}’s care plan.`)}
      ${para(`If a form is attached, fill in the highlighted sections and reply when you’re finished. We’re here if anything is unclear.`)}
      `,
      {
        label: 'Reply with completed forms',
        href: `mailto:${f.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Forms for ${child}`)}`,
      }
    )
  },

  MANUAL: (f) => {
    const child = childName(f)
    return wrap(
      `Update regarding ${child}`,
      f,
      `
      ${para(`We wanted to reach out regarding ${child}. Please see the message below, and reply if you have questions.`)}
      `
    )
  },
}
