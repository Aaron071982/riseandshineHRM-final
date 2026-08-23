import type { CommTemplate, CrmRole } from '@prisma/client'
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
  'CC_INTRODUCTION',
  'SCHEDULE_CONFIRMED',
  'MEET_AND_GREET',
  'CASE_COORDINATION_FORM',
  'MANUAL',
]

const ROLE_TEMPLATES: Partial<Record<CrmRole, CommTemplate[]>> = {
  INTAKE: ['WELCOME', 'CONSENT_REQUEST', 'DOCS_NEEDED'],
  BILLING: ['BENEFITS_UPDATE', 'AUTH_APPROVED'],
  AUTHORIZATION: ['BENEFITS_UPDATE', 'AUTH_APPROVED'],
  CLINICAL: ['ASSESSMENT_SCHEDULED'],
  CASE_COORDINATION: [
    'CONSENT_REQUEST',
    'CC_INTRODUCTION',
    'MEET_AND_GREET',
    'SCHEDULE_CONFIRMED',
    'RBT_ASSIGNED',
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

export function isTemplateAllowedForUser(
  user: CrmAccessSubject,
  template: CommTemplate
): boolean {
  return allowedTemplatesForUser(user).includes(template)
}

export function assertTemplateAllowedForUser(
  user: CrmAccessSubject,
  template: CommTemplate
): void {
  if (!isTemplateAllowedForUser(user, template)) {
    throw new CrmAccessError(
      `Your role is not permitted to send the ${template} template`,
      403
    )
  }
}
