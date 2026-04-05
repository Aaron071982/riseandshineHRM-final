/** Shared types for RBT profile view and subcomponents. */

export interface RBTProfileInterviewNotes {
  id: string
  greetingAnswer: string | null
  basicInfoAnswer: string | null
  experienceAnswer: string | null
  heardAboutAnswer: string | null
  abaPlatformsAnswer: string | null
  communicationAnswer: string | null
  availabilityAnswer: string | null
  payExpectationsAnswer: string | null
  previousCompanyAnswer: string | null
  expectationsAnswer: string | null
  closingNotes: string | null
  fullName: string | null
  email: string | null
  birthdate: string | null
  currentAddress: string | null
  phoneNumber: string | null
  createdAt: Date
  updatedAt: Date
}

export interface RBTProfileInterview {
  id: string
  scheduledAt: Date
  durationMinutes: number
  interviewerName: string
  status: string
  decision: string
  notes: string | null
  meetingUrl: string | null
  reminder_15m_sent_at: Date | null
  interviewNotes?: RBTProfileInterviewNotes | null
}

export interface RBTProfileOnboardingTask {
  id: string
  taskType: string
  title: string
  description: string | null
  isCompleted: boolean
  completedAt: Date | null
  uploadUrl: string | null
  documentDownloadUrl: string | null
  sortOrder: number
}

export interface RBTProfileDocument {
  id: string
  fileName: string
  fileType: string
  documentType: string | null
  uploadedAt: Date
}

export interface RBTProfileOnboardingCompletion {
  id: string
  documentId: string
  status: string
  completedAt: Date | null
  signedPdfUrl?: string | null
  /** True when a completed PDF is stored in DB (base64); not the raw payload (stripped on the client). */
  hasSignedPdfData?: boolean
  hasSignatureCertificate?: boolean
  acknowledgmentJson?: unknown
  document: {
    id: string
    title: string
    type: string
    slug?: string
  }
}

export interface RBTProfile {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  email: string | null
  locationCity: string | null
  locationState: string | null
  zipCode: string | null
  addressLine1: string | null
  addressLine2: string | null
  preferredServiceArea: string | null
  notes: string | null
  gender: string | null
  ethnicity: string | null
  fortyHourCourseCompleted: boolean
  status: string
  scheduleCompleted?: boolean
  source: string | null
  submittedAt: Date | null
  resumeUrl: string | null
  resumeFileName: string | null
  resumeMimeType: string | null
  resumeSize: number | null
  availabilityJson: unknown
  languagesJson: unknown
  experienceYears: number | null
  experienceYearsDisplay: string | null
  preferredAgeGroupsJson: unknown
  authorizedToWork: boolean | null
  canPassBackgroundCheck: boolean | null
  cprFirstAidCertified: string | null
  transportation: boolean | null
  preferredHoursRange: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    role: string
    isActive: boolean
  }
  interviews: RBTProfileInterview[]
  onboardingTasks: RBTProfileOnboardingTask[]
  documents?: RBTProfileDocument[]
  onboardingCompletions?: RBTProfileOnboardingCompletion[]
}
