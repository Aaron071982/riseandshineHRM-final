/** Large assessment PDFs / scans — 50 MB. Uploads go direct to storage (bypass Vercel body limit). */
export const MAX_ASSESSMENT_FILE_BYTES = 50 * 1024 * 1024

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

const PDF_TYPE = 'application/pdf'

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i

export function inferAssessmentAttachmentKind(input: {
  name: string
  type?: string | null
}): 'IMAGE' | 'PDF' | null {
  const mime = (input.type ?? '').toLowerCase().split(';')[0].trim()
  const name = input.name.trim()
  if (mime === PDF_TYPE || name.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (IMAGE_TYPES.has(mime) || IMAGE_EXT.test(name)) return 'IMAGE'
  return null
}

export function validateAssessmentFile(input: {
  kind: 'IMAGE' | 'PDF'
  name: string
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (!input.name.trim()) {
    return { ok: false, error: 'File name is required' }
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: 'Invalid file size' }
  }
  if (input.size > MAX_ASSESSMENT_FILE_BYTES) {
    return {
      ok: false,
      error: `File must be ${MAX_ASSESSMENT_FILE_BYTES / (1024 * 1024)} MB or smaller`,
    }
  }

  const mime = input.type.toLowerCase().split(';')[0].trim()
  if (input.kind === 'PDF') {
    if (mime !== PDF_TYPE && !input.name.toLowerCase().endsWith('.pdf')) {
      return { ok: false, error: 'Only PDF files are allowed' }
    }
    return { ok: true }
  }

  if (
    !IMAGE_TYPES.has(mime) &&
    !IMAGE_EXT.test(input.name) &&
    mime !== 'application/octet-stream'
  ) {
    return { ok: false, error: 'Only image files are allowed' }
  }
  return { ok: true }
}

export function assertAssessmentStoragePath(input: {
  serviceClientId: string
  assessmentId: string
  storagePath: string
}): void {
  const expectedPrefix = `clients/${input.serviceClientId}/assessments/${input.assessmentId}/`
  if (!input.storagePath.startsWith(expectedPrefix)) {
    throw new Error('Invalid storage path for this assessment')
  }
}

export function parseAssessmentAttachmentKind(
  value: string
): 'IMAGE' | 'PDF' | null {
  const v = value.toUpperCase()
  if (v === 'IMAGE' || v === 'PDF') return v
  return null
}
