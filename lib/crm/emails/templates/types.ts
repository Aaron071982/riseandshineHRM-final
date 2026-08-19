import type { CommTemplate } from '@prisma/client'

export type StaffMergeFields = {
  childFirstName: string
  childLastName: string
  parentName: string | null
  parentEmail: string | null
  coordinatorName: string | null
  rbtName: string | null
  startDate: string | null
  assessmentDate: string | null
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
