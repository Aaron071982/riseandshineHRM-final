import type { ClientStage, CommTemplate, CrmRole } from '@prisma/client'
import { CrmAccessError, isFullAccess, getUserCrmRoles, type CrmAccessSubject } from '@/lib/crm/access'

/** Human-composed staff email templates (excludes journey-only INQUIRY_ACK / SERVICES_STARTED). */
export const STAFF_EMAIL_TEMPLATES: CommTemplate[] = [
  'WELCOME',
  'CONSENT_REQUEST',
  'DOCS_NEEDED',
  'BENEFITS_UPDATE',
  'ASSESSMENT_SCHEDULED',
  'AUTH_APPROVED',
  'READY_FOR_STAFFING',
  'RBT_ASSIGNED',
  'SCHEDULE_CONFIRMED',
  'MEET_AND_GREET',
  'CASE_COORDINATION',
  'BCBA_ASSIGNED',
  'CASE_COORDINATION_FORM',
  'WAITLIST_NOTICE',
  'MANUAL',
]

/** Sole template available while a client is on WAITLIST. */
export const WAITLIST_ONLY_TEMPLATES: CommTemplate[] = ['WAITLIST_NOTICE']

const ROLE_TEMPLATES: Partial<Record<CrmRole, CommTemplate[]>> = {
  INTAKE: ['WELCOME', 'CONSENT_REQUEST', 'DOCS_NEEDED', 'WAITLIST_NOTICE'],
  BILLING: ['BENEFITS_UPDATE', 'AUTH_APPROVED'],
  AUTHORIZATION: ['BENEFITS_UPDATE', 'AUTH_APPROVED'],
  CLINICAL: ['ASSESSMENT_SCHEDULED', 'BCBA_ASSIGNED'],
  CASE_COORDINATION: [
    'CONSENT_REQUEST',
    'MEET_AND_GREET',
    'CASE_COORDINATION',
    'BCBA_ASSIGNED',
    'SCHEDULE_CONFIRMED',
    'RBT_ASSIGNED',
    'WAITLIST_NOTICE',
  ],
}

export function templatesForRoles(roles: CrmRole[]): CommTemplate[] {
  const allowed = new Set<CommTemplate>()
  for (const role of roles) {
    for (const t of ROLE_TEMPLATES[role] ?? []) allowed.add(t)
  }
  return STAFF_EMAIL_TEMPLATES.filter((t) => allowed.has(t))
}

export function allowedTemplatesForUser(user: CrmAccessSubject): CommTemplate[] {
  if (isFullAccess(user)) return [...STAFF_EMAIL_TEMPLATES]
  return templatesForRoles(getUserCrmRoles(user))
}

/**
 * Templates offered on a specific client. Waitlist clients only get the
 * waitlist notice — no intake/welcome/manual compose options.
 */
export function allowedTemplatesForClient(
  user: CrmAccessSubject,
  stage: ClientStage | null | undefined
): CommTemplate[] {
  if (stage === 'WAITLIST') return [...WAITLIST_ONLY_TEMPLATES]
  return allowedTemplatesForUser(user).filter((t) => t !== 'WAITLIST_NOTICE')
}

export function isTemplateAllowedForUser(
  user: CrmAccessSubject,
  template: CommTemplate,
  stage?: ClientStage | null
): boolean {
  if (stage === 'WAITLIST') {
    return WAITLIST_ONLY_TEMPLATES.includes(template)
  }
  if (template === 'WAITLIST_NOTICE') {
    return allowedTemplatesForUser(user).includes(template)
  }
  return allowedTemplatesForUser(user).includes(template)
}

export function assertTemplateAllowedForUser(
  user: CrmAccessSubject,
  template: CommTemplate,
  stage?: ClientStage | null
): void {
  if (!isTemplateAllowedForUser(user, template, stage)) {
    throw new CrmAccessError(
      stage === 'WAITLIST'
        ? 'Waitlist clients may only receive the waitlist notice email'
        : `Your role is not permitted to send the ${template} template`,
      403
    )
  }
}
