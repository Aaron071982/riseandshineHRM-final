import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  childName,
  ctaButton,
  escapeHtml,
  greeting,
  infoBlock,
  para,
  staffSignature,
} from './shell'
import {
  contactBlock,
  emailGuideSection,
  formatClientAddress,
  meetGreetWeeklyScheduleTable,
} from './helpers'

function scheduleForMeetGreet(fields: StaffMergeFields) {
  const rbt = fields.rbtName?.trim()
  if (!rbt) return fields.scheduleSlots
  const filtered = fields.scheduleSlots.filter((s) => s.rbtName === rbt)
  return filtered.length ? filtered : fields.scheduleSlots
}

function guideList(items: string[]): string {
  return `<ul style="margin:8px 0 0;padding-left:18px;">${items
    .map((i) => `<li style="margin:0 0 8px;line-height:1.5;">${i}</li>`)
    .join('')}</ul>`
}

function guideIntroBanner(rbtName: string | null): string {
  const who = rbtName
    ? `<strong style="color:#c45a1a;">${escapeHtml(rbtName)}</strong>`
    : 'your new Behavior Technician'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
  <tr>
    <td style="padding:20px 22px;background:linear-gradient(135deg,#fff8f2 0%,#fffcf8 100%);border:1px solid #f0dcc8;border-left:4px solid #f2652a;border-radius:0 12px 12px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c45a1a;margin-bottom:8px;">Meet &amp; Greet Guide for Families</div>
      <div style="font-size:17px;font-weight:700;color:#2f2318;line-height:1.35;">Welcome — meet ${who}</div>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#6b5e52;">We are excited to introduce you to your child&apos;s Behavior Technician. This meet-and-greet is a chance for your family to get comfortable and make sure it is the right fit before services begin.</p>
    </td>
  </tr>
</table>`
}

export function renderMeetAndGreet(fields: StaffMergeFields): StaffEmailContent {
  const child = childName(fields)
  const rbt = fields.rbtName?.trim() || null
  const coord = fields.coordinatorName?.trim() || 'your Case Coordinator'
  const address = formatClientAddress(fields)
  const slots = scheduleForMeetGreet(fields)

  const coordContact = contactBlock('Your Case Coordinator', [
    { label: 'Name', value: fields.coordinatorName },
    { label: 'Phone', value: fields.coordinatorPhone || COMPANY_PHONE },
    {
      label: 'Email',
      value: fields.coordinatorEmail
        ? fields.coordinatorEmail
        : COMPANY_EMAIL,
    },
  ])

  return {
    subject: rbt
      ? `Meet & Greet — ${rbt} for ${child}`
      : `Meet and Greet for ${child}`,
    bodyHtml: `
      ${para(greeting(fields))}
      ${para(`We would like to schedule a short meet and greet so you can connect with ${child}&apos;s care team before services begin. This is a chance to ask questions and make sure everyone feels comfortable.`)}
      ${infoBlock('What happens next', [
        'Reply with a few times that work this week, and we will confirm your visit.',
        'Review the guide below — it walks through what to expect during the meet-and-greet.',
        'We will send the official Meet &amp; Greet form separately for you to review, complete, and sign.',
      ])}

      ${guideIntroBanner(rbt)}

      ${emailGuideSection(
        'Before the visit — preparation',
        guideList([
          'Have your child&apos;s favorite toys, activities, or snacks available.',
          'Some Behavior Technicians may be newer to the field — they receive intensive training and ongoing supervision from an experienced BCBA.',
          'Your BCBA provides clinical oversight throughout services.',
        ])
      )}

      ${emailGuideSection(
        'During the meet &amp; greet',
        `<ol style="margin:8px 0 0;padding-left:18px;">
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Introductions</strong> — Welcome the BT and introduce your child in a calm, comfortable way.</li>
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Child preferences</strong> — Share favorite activities, toys, and routines; provide materials that may help the BT engage.</li>
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Interaction period</strong> — If you are comfortable, allow a short play or interaction so everyone can get acquainted.</li>
          <li style="margin:0 0 10px;line-height:1.55;"><strong>Family introduction</strong> — Introduce other household members to promote comfort and familiarity.</li>
        </ol>`
      )}

      ${emailGuideSection(
        'Important home &amp; safety topics',
        guideList([
          '<strong>Allergies</strong> (child &amp; household) — food, environmental, medication, or other sensitivities.',
          '<strong>Pets in the home</strong> — type of pet(s), whether they will be present during sessions, and how they are secured.',
          '<strong>Therapist allergies or sensitivities</strong> — pet dander, smoke, strong fragrances, etc.',
          '<strong>House rules</strong> — shoes, food areas, restricted rooms, or other expectations.',
          '<strong>Medications</strong> — anything the BT should know for safety and care.',
        ]) +
          `<p style="margin:12px 0 0;font-size:13px;color:#6b5e52;font-style:italic;">You will record full details on the official form we send later — this email is your preview guide.</p>`
      )}

      ${emailGuideSection(
        'Questions to discuss',
        `<p style="margin:0 0 8px;"><strong>You may ask the Behavior Technician:</strong></p>
        ${guideList([
          'What is your preferred method of communication?',
          'Is there anything you need to feel comfortable in our home?',
        ])}
        <p style="margin:14px 0 8px;"><strong>The Behavior Technician may ask you:</strong></p>
        ${guideList([
          'Are there house rules or safety concerns we should know?',
          'Is there anything specific we should know about your child?',
          'What does your child enjoy most?',
        ])}`
      )}

      ${emailGuideSection(
        'After the meet &amp; greet',
        guideList([
          'Consider how your child responded and whether the interaction felt positive.',
          'Contact your Case Coordinator with feedback, questions, or schedule updates.',
          'Confirm next steps once you feel confident about moving forward.',
        ])
      )}

      ${coordContact}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
        <tr>
          <td style="padding:18px 20px;background:#fff8f2;border:1px solid #f0dcc8;border-radius:10px;">
            <div style="font-size:13px;font-weight:700;color:#8b4513;margin:0 0 8px;">Schedule information</div>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#2f2318;">Please review the planned weekly service times below. Times may change based on clinical needs, staff availability, and authorization limits.</p>
            ${meetGreetWeeklyScheduleTable(slots)}
            ${
              address
                ? `<p style="margin:14px 0 0;font-size:14px;color:#2f2318;"><strong>Service address:</strong> ${escapeHtml(address)}</p>`
                : ''
            }
            <p style="margin:14px 0 0;font-size:13px;color:#6b5e52;font-style:italic;">Signature and formal sign-off will be collected on the Meet &amp; Greet form we send separately — not in this email.</p>
          </td>
        </tr>
      </table>

      ${para(`We look forward to working with your family and appreciate your partnership. If you have scheduling questions, reply to this email or call us at ${COMPANY_PHONE}.`)}
      ${ctaButton('Share your availability', `mailto:${fields.staffEmail || COMPANY_EMAIL}?subject=${encodeURIComponent(`Meet and Greet for ${child}`)}`)}
      ${staffSignature(fields)}
    `,
  }
}
