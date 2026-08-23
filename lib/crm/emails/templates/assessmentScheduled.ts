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

export function renderAssessmentScheduled(
  fields: StaffMergeFields
): StaffEmailContent {
  const child = childName(fields)
  const when = fields.assessmentDate
    ? ` on <strong>${fields.assessmentDate}</strong>`
    : ''
  const modality =
    fields.assessmentModality === 'TELEHEALTH'
      ? 'Telehealth'
      : fields.assessmentModality === 'IN_HOME'
        ? 'In-home'
        : null
  const modalityLine = modality
    ? ` This visit will be <strong>${modality}</strong>.`
    : ''

  return {
    subject: `Assessment scheduled for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`An assessment has been scheduled for ${child}${when}.${modalityLine}`)}
      ${infoBlock('Before the visit', [
        modality === 'In-home'
          ? 'Have a quiet space ready in your home for the assessment.'
          : modality === 'Telehealth'
            ? 'Test your camera and microphone, and find a quiet space for the video visit.'
            : 'Have a quiet space ready for the visit.',
        'Bring any recent evaluations or school documents you want us to see.',
        'Write down your questions — we will make time for them.',
      ])}
      ${para(`We will confirm details with you before the appointment. Reply if you need to reschedule.`)}
      ${ctaButton('Ask a question', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Assessment for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
