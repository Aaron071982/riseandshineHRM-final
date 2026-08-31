import type { CommTemplate } from '@prisma/client'
import { renderAssessmentScheduled } from './assessmentScheduled'
import { renderAuthApproved } from './authApproved'
import { renderBenefitsUpdate } from './benefitsUpdate'
import { renderConsentRequest } from './consentRequest'
import { renderDocsNeeded } from './docsNeeded'
import { renderMeetAndGreet } from './meetAndGreet'
import { renderCaseCoordination } from './caseCoordination'
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
  SCHEDULE_CONFIRMED: renderScheduleConfirmed,
  MEET_AND_GREET: renderMeetAndGreet,
  CASE_COORDINATION: renderCaseCoordination,
  ...LEGACY_RENDERERS,
}

/** Templates that embed the first attached link as {{portalLink}} in the body. */
const PORTAL_LINK_TEMPLATES = new Set<CommTemplate>(['DOCS_NEEDED'])

export function renderStaffEmail(
  template: CommTemplate,
  fields: StaffMergeFields,
  overrides?: StaffEmailRenderOverrides
): RenderedStaffEmail | null {
  const base = RENDERERS[template]
  if (!base && template !== 'MANUAL') return null

  const links = overrides?.links ?? []
  const usesPortal = PORTAL_LINK_TEMPLATES.has(template)
  const portalFromLink = usesPortal ? links[0]?.url?.trim() || null : null

  const mergedFields: StaffMergeFields = {
    ...fields,
    portalLink: portalFromLink || fields.portalLink || null,
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

  // Avoid duplicating the portal CTA in the footer links strip.
  const linksForShell: EmailLinkMeta[] | undefined = usesPortal
    ? links.slice(1)
    : links

  const html = wrapStaffEmail(innerHtml, {
    attachments: overrides?.attachments,
    links: linksForShell?.length ? linksForShell : undefined,
    template,
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
    WELCOME: 'Welcome (packet)',
    CONSENT_REQUEST: 'Intake & consent',
    DOCS_NEEDED: 'Documents needed (nudge)',
    BENEFITS_UPDATE: 'Benefits update',
    ASSESSMENT_SCHEDULED: 'Assessment scheduled',
    AUTH_APPROVED: 'Authorization approved',
    READY_FOR_STAFFING: 'Ready for staffing',
    RBT_ASSIGNED: 'RBT assigned',
    SCHEDULE_CONFIRMED: 'Schedule confirmed',
    MEET_AND_GREET: 'Meet & greet',
    CASE_COORDINATION: 'Case coordination (team)',
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
export {
  PARENT_MILESTONES,
  TEMPLATE_MILESTONE,
  milestoneForTemplate,
} from './milestones'
export {
  renderWeeklyActivitySummary,
  type WeeklyActivitySummaryFields,
} from './weeklyActivitySummary'
