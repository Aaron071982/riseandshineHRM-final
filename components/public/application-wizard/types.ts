/** Shared types for the public RBT application wizard steps. */

export interface ApplicationData {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  city: string
  state: string
  zipCode: string
  addressLine1: string
  addressLine2: string
  gender: string
  ethnicity: string
  fortyHourCourseCompleted: string
  experienceYears: string
  preferredAgeGroups: string[]
  languages: string[]
  otherLanguage: string
  transportation: string
  weekdayAvailability: { [key: string]: boolean }
  weekendAvailability: { [key: string]: boolean }
  preferredHoursRange: string
  earliestStartTime: string
  latestEndTime: string
  authorizedToWork: string
  canPassBackgroundCheck: string
  cprFirstAidCertified: string
  notes: string
  resume: File | null
  resumeUrl: string | null
  idDocument: File | null
  idDocumentUrl: string | null
  rbtCertificate: File | null
  cprCard: File | null
  website?: string
}
