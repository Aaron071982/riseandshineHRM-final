import type { CommTemplate } from '@prisma/client'
import { renderAssessmentScheduled } from './assessmentScheduled'
import { renderAuthApproved } from './authApproved'
import { renderBenefitsUpdate } from './benefitsUpdate'
import { renderCcIntroduction } from './ccIntroduction'
import { renderConsentRequest } from './consentRequest'
import { renderDocsNeeded } from './docsNeeded'
import { renderMeetAndGreet } from './meetAndGreet'
import { renderRbtAssigned } from './rbtAssigned'
import { renderReadyForStaffing } from './readyForStaffing'
import { renderScheduleConfirmed } from './scheduleConfirmed'
import { renderWelcome } from './welcome'
import { LEGACY_RENDERERS } from './legacy'
import {
  htmlToPlainText,
  wrapStaffEmail,
  type EmailAttachmentMeta,
  type EmailLinkMeta,
} from './shell'
import type {
  RenderedStaffEmail,
  StaffEmailRenderOverrides,
  StaffMergeFields,
} from './types'

const RENDERERS: Partial<
  Record<CommTemplate, (f: StaffMergeFields) => { subject: string; bodyHtml: string }>
> = {
  WELCOME: renderWelcome,
  CONSENT_REQUEST: renderConsentRequest,
  DOCS_NEEDED: renderDocsNeeded,
  BENEFITS_UPDATE: renderBenefitsUpdate,
  ASSESSMENT_SCHEDULED: renderAssessmentScheduled,
  AUTH_APPROVED: renderAuthApproved,
  READY_FOR_STAFFING: renderReadyForStaffing,
  RBT_ASSIGNED: renderRbtAssigned,
  CC_INTRODUCTION: renderCcIntroduction,
  SCHEDULE_CONFIRMED: renderScheduleConfirmed,
  MEET_AND_GREET: renderMeetAndGreet,
  ...LEGACY_RENDERERS,
}

export function renderStaffEmail(
  template: CommTemplate,
  fields: StaffMergeFields,
  overrides?: StaffEmailRenderOverrides
): RenderedStaffEmail | null {
  const base = RENDERERS[template]
  if (!base && template !== 'MANUAL') return null

  const mergedFields: StaffMergeFields = {
    ...fields,
    assessmentModality:
      overrides?.assessmentModality !== undefined
        ? overrides.assessmentModality
        : fields.assessmentModality,
  }

  let subject: string
  let innerHtml: string

  if (template === 'MANUAL' && overrides?.bodyHtml) {
    subject = overrides.subject?.trim() || `Message regarding ${fields.childFirstName}`
    innerHtml = overrides.bodyHtml
  } else if (base) {
    const rendered = base(mergedFields)
    subject = overrides?.subject?.trim() || rendered.subject
    innerHtml = overrides?.bodyHtml?.trim() || rendered.bodyHtml
  } else {
    return null
  }

  const html = wrapStaffEmail(innerHtml, {
    attachments: overrides?.attachments,
    links: overrides?.links,
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
    CONSENT_REQUEST: 'Consent request',
    DOCS_NEEDED: 'Documents needed',
    BENEFITS_UPDATE: 'Benefits update',
    ASSESSMENT_SCHEDULED: 'Assessment scheduled',
    AUTH_APPROVED: 'Authorization approved',
    READY_FOR_STAFFING: 'Ready for staffing',
    RBT_ASSIGNED: 'RBT assigned',
    CC_INTRODUCTION: 'Case coordinator introduction',
    SCHEDULE_CONFIRMED: 'Schedule confirmed',
    MEET_AND_GREET: 'Meet & greet',
    CASE_COORDINATION_FORM: 'Case coordination form (legacy)',
    MANUAL: 'Manual / freeform',
    INQUIRY_ACK: 'Inquiry acknowledgment',
    SERVICES_STARTED: 'Services started',
  }
  return labels[template] ?? template.replace(/_/g, ' ').toLowerCase()
}

export type { StaffMergeFields, RenderedStaffEmail, StaffEmailRenderOverrides } from './types'
export type { EmailAttachmentMeta, EmailLinkMeta } from './shell'
export { EMAIL_LOGO_URL } from './shell'
