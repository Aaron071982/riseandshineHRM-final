import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  ACCENT,
  BODY_TEXT,
  ctaButton,
  dearGreeting,
  infoBlock,
  officeEmail,
  officePhone,
  para,
  sectionRule,
  teamSignature,
} from './shell'
import { childName } from './helpers'
import { DEFAULT_MISSING_DOCS_COPY } from './docsNeeded'
import {
  PARENT_FORM_FILES,
  parentFormPublicUrl,
} from '@/lib/crm/emails/parentFormDownloads'

function documentsNeededListHtml(fields: StaffMergeFields): string {
  const items =
    fields.missingDocsList.length > 0
      ? fields.missingDocsList
      : DEFAULT_MISSING_DOCS_COPY
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 10px;padding:0;line-height:1.55;color:${BODY_TEXT};">${item}</li>`
    )
    .join('')
  return `${sectionRule('Documents we need from you')}
<ul style="margin:0 0 8px;padding-left:20px;font-size:14px;">${lis}</ul>`
}

function blankFormsDownloadBlock(): string {
  const rows = (
    [
      ['welcome-packet', PARENT_FORM_FILES['welcome-packet'].label],
      ['intake-form', PARENT_FORM_FILES['intake-form'].label],
      ['consent-form', PARENT_FORM_FILES['consent-form'].label],
    ] as const
  )
    .map(
      ([slug, label]) =>
        `<tr><td style="padding:6px 0;">${ctaButton(label, parentFormPublicUrl(slug))}</td></tr>`
    )
    .join('')
  return `${sectionRule('Blank forms — download if needed')}
<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:${BODY_TEXT};">These forms are also attached to this email. If an attachment is missing, use the buttons below:</p>
<table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`
}

/**
 * Combined first-touch email: welcome packet + intake/consent forms + document list.
 * DOCS_NEEDED remains the later nudge if items are still outstanding.
 */
export function renderWelcome(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const phone = officePhone(fields)
  const email = officeEmail(fields)

  return {
    subject: `Welcome to Rise & Shine ABA — ${child}'s packet, forms, and documents`,
    bodyHtml: `
      ${para(dearGreeting(fields))}
      ${para(`Welcome to Rise &amp; Shine ABA, and thank you for trusting us with <strong>${child}</strong>&apos;s care. Choosing an ABA provider is a real decision, and we&apos;re grateful you&apos;ve chosen us to walk alongside your family.`)}
      ${para(`We&apos;ve attached your <strong>Parent Welcome Packet</strong>. Please take a few minutes to read it when you can — it explains, in plain language, how ABA services work, who will be on ${child}&apos;s team, and the step-by-step journey from today through the first session. There are no surprises hidden in it.`)}
      ${para(`One thing we want to say clearly from the start: much of how quickly ${child} can begin depends on your <strong>insurance company</strong>, not on us. We will be honest with you at every stage about where things stand — including when a delay is on the insurer&apos;s side. You will never be left wondering.`)}

      ${sectionRule('Your action items — please complete these')}
      ${para(`<strong style="color:${ACCENT};">This is the single most important step you can take right now.</strong> Completing the forms and sending the documents below — thoroughly and accurately the first time — is what lets us verify insurance and request authorization so ${child} can start sooner.`)}

      ${infoBlock('1. Forms to complete and return', [
        `The <strong>Client Intake Form (Form 01)</strong> — everything we need to verify ${child}&apos;s insurance and request authorization for services.`,
        `The <strong>Consent &amp; Authorization Form (Form 02)</strong> — your permission to assess and treat ${child}, and to share with your insurance only what they require to pay for that care. You consent to each item separately; nothing is all-or-nothing.`,
      ])}
      ${para(`Blank copies of both forms are attached to this email (and linked below). Please <strong>complete them and email the finished copies back</strong> — reply to this message or send them to <a href="mailto:${email}" style="color:${ACCENT};text-decoration:none;">${email}</a>.`)}
      ${blankFormsDownloadBlock()}

      ${documentsNeededListHtml(fields)}
      ${para(`<strong>Prioritize these first</strong> if you&apos;re gathering things piece by piece: <strong>insurance card (front and back)</strong>, <strong>diagnostic evaluation</strong>, and <strong>physician referral for ABA</strong>. We can&apos;t begin verifying benefits without the card, and we can&apos;t request authorization without the evaluation and referral. Send whatever you have now; you can always follow up with the rest.`)}
      ${para(`If a question on a form doesn&apos;t apply to ${child}, write <strong>&quot;N/A&quot;</strong> rather than leaving it blank — a blank answer slows us down because we can&apos;t tell &quot;doesn&apos;t apply&quot; from &quot;forgot.&quot; Please copy names and ID numbers <strong>exactly</strong> as they appear on the insurance card; a single wrong character can hold up approval by weeks.`)}

      ${para(`If anything is unclear, call us at <a href="tel:+18888984774" style="color:${ACCENT};text-decoration:none;">${phone}</a> or email <a href="mailto:${email}" style="color:${ACCENT};text-decoration:none;">${email}</a> before you sign — we would always rather answer a question twice than have you worry once.`)}
      ${para(`We&apos;ll follow up later only if something is still outstanding. For now, thank you again for choosing Rise &amp; Shine — we&apos;re glad you&apos;re here.`)}
      ${teamSignature()}
    `,
  }
}
