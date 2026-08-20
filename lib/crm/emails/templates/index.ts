import type { CommTemplate } from '@prisma/client'
import { renderDocsNeeded } from './docsNeeded'
import { htmlToPlainText, wrapStaffEmail, type EmailAttachmentMeta } from './shell'
import { STUB_RENDERERS } from './stubs'
import type { RenderedStaffEmail, StaffMergeFields } from './types'
import { renderWelcome } from './welcome'

const RENDERERS: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => { subject: string; bodyHtml: string }>
> = {
  WELCOME: renderWelcome,
  DOCS_NEEDED: renderDocsNeeded,
  ...STUB_RENDERERS,
}

export function renderStaffEmail(
  template: CommTemplate,
  fields: StaffMergeFields,
  overrides?: {
    subject?: string
    bodyHtml?: string
    attachments?: EmailAttachmentMeta[]
  }
): RenderedStaffEmail | null {
  const base = RENDERERS[template]
  if (!base && template !== 'MANUAL') return null

  let subject: string
  let innerHtml: string

  if (template === 'MANUAL' && overrides?.bodyHtml) {
    subject = overrides.subject?.trim() || `Message regarding ${fields.childFirstName}`
    innerHtml = overrides.bodyHtml
  } else if (base) {
    const rendered = base(fields)
    subject = overrides?.subject?.trim() || rendered.subject
    innerHtml = overrides?.bodyHtml?.trim() || rendered.bodyHtml
  } else {
    return null
  }

  const html = wrapStaffEmail(innerHtml, {
    attachments: overrides?.attachments,
  })
  return {
    template,
    subject,
    html,
    text: htmlToPlainText(html),
  }
}

export function staffTemplateLabel(template: CommTemplate): string {
  const labels: Partial<Record<CommTemplate, string>> = {
    WELCOME: 'Welcome',
    DOCS_NEEDED: 'Documents needed',
    CONSENT_REQUEST: 'Consent request',
    BENEFITS_UPDATE: 'Benefits update',
    ASSESSMENT_SCHEDULED: 'Assessment scheduled',
    AUTH_APPROVED: 'Authorization approved',
    READY_FOR_STAFFING: 'Ready for staffing',
    RBT_ASSIGNED: 'RBT assigned',
    SCHEDULE_CONFIRMED: 'Schedule confirmed',
    MEET_AND_GREET: 'Meet & greet',
    CASE_COORDINATION_FORM: 'Case coordination form',
    MANUAL: 'Manual / freeform',
    INQUIRY_ACK: 'Inquiry acknowledgment',
    SERVICES_STARTED: 'Services started',
  }
  return labels[template] ?? template.replace(/_/g, ' ').toLowerCase()
}

export type { StaffMergeFields, RenderedStaffEmail } from './types'
export type { EmailAttachmentMeta } from './shell'
export { EMAIL_LOGO_URL } from './shell'
