import { ASSESSMENT_FILES_BUCKET, ASSESSMENT_FILES_PREFIX } from '@/lib/constants'

const UNSAFE_FILENAME = /[^a-zA-Z0-9._-]+/g

export function sanitizeAssessmentFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base.replace(UNSAFE_FILENAME, '_').replace(/^_+|_+$/g, '')
  return cleaned.length > 0 ? cleaned.slice(0, 180) : 'file'
}

/** Supabase Storage object path inside ASSESSMENT_FILES_BUCKET. */
export function buildAssessmentStoragePath(params: {
  serviceClientId: string
  assessmentId: string
  sectionKey: string
  fileName: string
  fileId?: string
}): string {
  const safeName = sanitizeAssessmentFileName(params.fileName)
  const id = params.fileId ?? crypto.randomUUID()
  return `${ASSESSMENT_FILES_PREFIX}/${params.serviceClientId}/assessments/${params.assessmentId}/${params.sectionKey}/${id}-${safeName}`
}

export { ASSESSMENT_FILES_BUCKET }

/** Section key for uploaded completed assessment PDF (Phase 1B). */
export const UPLOADED_PDF_SECTION_KEY = 'uploaded_pdf'
