export const ASSESSMENT_TYPES = ['INITIAL', 'REASSESSMENT'] as const

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number]

export function isReassessment(assessmentType: string | null | undefined): boolean {
  return assessmentType === 'REASSESSMENT'
}

export function assessmentTypeLabel(assessmentType: string | null | undefined): string {
  return isReassessment(assessmentType) ? 'Reassessment' : 'Initial assessment'
}

export function assessmentDocumentTitle(assessmentType: string | null | undefined): string {
  return isReassessment(assessmentType)
    ? 'Reassessment & Treatment Plan'
    : 'Initial Assessment & Treatment Plan'
}
