import type { CommTemplate } from '@prisma/client'

export type ScheduleSlotRow = {
  dayOfWeek: number
  startTime: string
  endTime: string
  rbtName: string
}

export type AssessmentModality = 'IN_HOME' | 'TELEHEALTH'

export type StaffMergeFields = {
  childFirstName: string
  childLastName: string
  parentName: string | null
  parentFirstName: string | null
  parentEmail: string | null
  parentPhone: string | null
  clientAddressLine: string | null
  clientCity: string | null
  clientState: string | null
  clientZip: string | null
  coordinatorName: string | null
  coordinatorEmail: string | null
  coordinatorPhone: string | null
  /** Display title for coordinator signature (e.g. Case Coordinator). */
  coordinatorTitle: string | null
  /**
   * Secure parent portal URL for uploads / forms.
   * Prefer staff-attached link; never put PHI in the email body.
   */
  portalLink: string | null
  /** Outstanding document labels for DOCS_NEEDED nudge (system-filled). */
  missingDocsList: string[]
  rbtName: string | null
  rbtEmail: string | null
  rbtPhone: string | null
  rbtAddressLine: string | null
  rbtCity: string | null
  rbtState: string | null
  rbtZip: string | null
  bcbaName: string | null
  bcbaEmail: string | null
  bcbaPhone: string | null
  scheduleSlots: ScheduleSlotRow[]
  startDate: string | null
  assessmentDate: string | null
  /** Compose-time choice for ASSESSMENT_SCHEDULED — not stored on client. */
  assessmentModality: AssessmentModality | null
  staffName: string
  staffEmail: string | null
  companyPhone: string
  companyEmail: string
  companyName: string
}

export type RenderedStaffEmail = {
  template: CommTemplate
  subject: string
  html: string
  text: string
}

export type StaffEmailContent = {
  subject: string
  bodyHtml: string
}

export type StaffEmailRenderOverrides = {
  subject?: string
  bodyHtml?: string
  attachments?: import('./shell').EmailAttachmentMeta[]
  links?: import('./shell').EmailLinkMeta[]
  assessmentModality?: AssessmentModality | null
}
