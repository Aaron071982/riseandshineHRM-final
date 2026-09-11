import type { CommTemplate } from '@prisma/client'

/** Human-readable labels for staff email templates (client-safe). */
export function staffTemplateLabel(template: CommTemplate): string {
  const labels: Partial<Record<CommTemplate, string>> = {
    WELCOME: 'Welcome + intake packet',
    CONSENT_REQUEST: 'Welcome + intake packet',
    DOCS_NEEDED: 'Documents needed (nudge)',
    BENEFITS_UPDATE: 'Benefits update',
    ASSESSMENT_SCHEDULED: 'Assessment scheduled',
    AUTH_APPROVED: 'Authorization approved',
    READY_FOR_STAFFING: 'Ready for staffing',
    RBT_ASSIGNED: 'RBT assigned',
    SCHEDULE_CONFIRMED: 'Schedule confirmed',
    MEET_AND_GREET: 'Meet & greet',
    CASE_COORDINATION: 'Case coordination (team)',
    BCBA_ASSIGNED: 'BCBA case assignment',
    CASE_COORDINATION_FORM: 'Case coordination form (legacy)',
    MANUAL: 'Manual / freeform',
    INQUIRY_ACK: 'Inquiry acknowledgment',
    SERVICES_STARTED: 'Services started',
  }
  return labels[template] ?? template.replace(/_/g, ' ').toLowerCase()
}
