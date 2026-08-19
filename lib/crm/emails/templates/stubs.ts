import type { CommTemplate } from '@prisma/client'
import type { StaffEmailContent, StaffMergeFields } from './types'
import { childName, greeting, staffSignature } from './shell'

function stub(
  subject: string,
  paragraph: string,
  fields: StaffMergeFields
): StaffEmailContent {
  return {
    subject,
    bodyHtml: `
      <p style="margin:0 0 16px;">${greeting(fields)}</p>
      <p style="margin:0 0 16px;">${paragraph}</p>
      <p style="margin:0;font-size:13px;color:#6b5e52;font-style:italic;">[Template copy pending — please review before sending.]</p>
      ${staffSignature(fields)}
    `,
  }
}

export const STUB_RENDERERS: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => StaffEmailContent>
> = {
  CONSENT_REQUEST: (f) =>
    stub(
      `Consent forms for ${childName(f)} — next step`,
      `We are ready for the next step in ${childName(f)}'s journey. Please review and complete the consent forms so we can continue.`,
      f
    ),
  BENEFITS_UPDATE: (f) =>
    stub(
      `Benefits update for ${childName(f)}`,
      `We are verifying insurance benefits for ${childName(f)} and will share an update once eligibility is confirmed.`,
      f
    ),
  ASSESSMENT_SCHEDULED: (f) =>
    stub(
      `Assessment scheduled for ${childName(f)}`,
      `An assessment has been scheduled for ${childName(f)}${f.assessmentDate ? ` on <strong>${f.assessmentDate}</strong>` : ''}. We will confirm details before the visit.`,
      f
    ),
  AUTH_APPROVED: (f) =>
    stub(
      `Authorization approved for ${childName(f)}`,
      `Good news: authorization for ${childName(f)}'s ABA services has been approved. Our team will coordinate next steps with you.`,
      f
    ),
  READY_FOR_STAFFING: (f) =>
    stub(
      `Finding the right therapist for ${childName(f)}`,
      `${childName(f)} is ready for staffing. We are matching a therapist who fits your schedule and preferences.`,
      f
    ),
  RBT_ASSIGNED: (f) =>
    stub(
      `Meet ${f.rbtName || 'your therapist'} — assigned for ${childName(f)}`,
      `${f.rbtName ? `<strong>${f.rbtName}</strong> has` : 'A therapist has'} been assigned to work with ${childName(f)}. We will coordinate scheduling next.`,
      f
    ),
  SCHEDULE_CONFIRMED: (f) =>
    stub(
      `Schedule confirmed for ${childName(f)}`,
      `${childName(f)}'s therapy schedule is confirmed${f.startDate ? `. Planned start: <strong>${f.startDate}</strong>` : ''}.`,
      f
    ),
  MEET_AND_GREET: (f) =>
    stub(
      `Meet & greet for ${childName(f)}`,
      `We would like to schedule a meet & greet so you can connect with ${childName(f)}'s care team before services begin.`,
      f
    ),
  CASE_COORDINATION_FORM: (f) =>
    stub(
      `Case coordination forms for ${childName(f)}`,
      `Please review and complete the case coordination forms so we can finalize ${childName(f)}'s care plan.`,
      f
    ),
  MANUAL: (f) =>
    stub(
      `Update regarding ${childName(f)}`,
      `We wanted to reach out regarding ${childName(f)}.`,
      f
    ),
}
