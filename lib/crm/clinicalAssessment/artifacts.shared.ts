import type { AssessmentArtifactType } from '@prisma/client'
import { CRM_CLINICAL_ASSESSMENTS_PREFIX } from '@/lib/constants'

/** Large assessment PDFs — 50 MB cap (bucket must allow this size). */
export const MAX_CLINICAL_ASSESSMENT_BYTES = 50 * 1024 * 1024

export const VERCEL_CLINICAL_ASSESSMENT_UPLOAD_BODY_LIMIT_BYTES = Math.floor(
  4.5 * 1024 * 1024
)

/** Required before Lock — composite initial assessment report only. */
export const REQUIRED_ASSESSMENT_ARTIFACT_TYPES: readonly AssessmentArtifactType[] = [
  'INITIAL_REPORT',
] as const

/** Optional attachments when instruments are filed separately from the report. */
export const OPTIONAL_ASSESSMENT_ARTIFACT_TYPES: readonly AssessmentArtifactType[] = [
  'VINELAND_3',
  'ATEC',
  'FAST',
  'JUSTIFICATION',
] as const

export const ALL_ASSESSMENT_ARTIFACT_TYPES: readonly AssessmentArtifactType[] = [
  ...REQUIRED_ASSESSMENT_ARTIFACT_TYPES,
  ...OPTIONAL_ASSESSMENT_ARTIFACT_TYPES,
] as const

export const ASSESSMENT_ARTIFACT_LABELS: Record<AssessmentArtifactType, string> = {
  INITIAL_REPORT: 'Initial assessment report',
  VINELAND_3: 'Vineland-3',
  ATEC: 'ATEC',
  FAST: 'FAST',
  JUSTIFICATION: 'Justification',
}

const PDF_TYPES = new Set(['application/pdf'])
const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/webp',
])
const PDF_EXT = new Set(['pdf'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'heic', 'heif', 'webp'])
const FAST_EXT = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'])

type ArtifactRule = {
  contentTypes: Set<string>
  extensions: Set<string>
}

const ARTIFACT_RULES: Record<AssessmentArtifactType, ArtifactRule> = {
  INITIAL_REPORT: { contentTypes: PDF_TYPES, extensions: PDF_EXT },
  VINELAND_3: {
    contentTypes: new Set([...PDF_TYPES, ...IMAGE_TYPES]),
    extensions: new Set([...PDF_EXT, ...IMAGE_EXT]),
  },
  ATEC: {
    contentTypes: new Set([...PDF_TYPES, ...IMAGE_TYPES]),
    extensions: new Set([...PDF_EXT, ...IMAGE_EXT]),
  },
  FAST: { contentTypes: IMAGE_TYPES, extensions: FAST_EXT },
  JUSTIFICATION: { contentTypes: PDF_TYPES, extensions: PDF_EXT },
}

export function isStoredClinicalAssessmentPath(
  storagePath: string | null | undefined
): boolean {
  if (!storagePath?.trim()) return false
  return storagePath.trim().startsWith(`${CRM_CLINICAL_ASSESSMENTS_PREFIX}/`)
}

export function parseAssessmentArtifactType(
  raw: string
): AssessmentArtifactType | null {
  const normalized = raw.trim().toUpperCase()
  if (
    (ALL_ASSESSMENT_ARTIFACT_TYPES as readonly string[]).includes(normalized)
  ) {
    return normalized as AssessmentArtifactType
  }
  return null
}

export function validateClinicalAssessmentFile(input: {
  artifactType: AssessmentArtifactType
  name: string
  size: number
  type: string
}): { ok: true } | { ok: false; error: string } {
  if (input.size <= 0) {
    return { ok: false, error: 'File is empty' }
  }
  if (input.size > MAX_CLINICAL_ASSESSMENT_BYTES) {
    return {
      ok: false,
      error: `File must be ${MAX_CLINICAL_ASSESSMENT_BYTES / (1024 * 1024)} MB or smaller`,
    }
  }
  const ext = input.name.split('.').pop()?.toLowerCase() ?? ''
  const contentType = input.type?.trim().toLowerCase() ?? ''
  const rule = ARTIFACT_RULES[input.artifactType]
  const extOk = rule.extensions.has(ext)
  const typeOk =
    !contentType ||
    contentType === 'application/octet-stream' ||
    rule.contentTypes.has(contentType)
  if (!extOk && !typeOk) {
    return {
      ok: false,
      error: `Invalid file type for ${ASSESSMENT_ARTIFACT_LABELS[input.artifactType]}`,
    }
  }
  return { ok: true }
}

export function assertClinicalAssessmentStoragePath(input: {
  clientId: string
  assessmentId: string
  storagePath: string
}): void {
  const prefix = `${CRM_CLINICAL_ASSESSMENTS_PREFIX}/${input.clientId}/${input.assessmentId}/`
  if (!input.storagePath.trim().startsWith(prefix)) {
    throw new Error('Invalid clinical assessment storage path')
  }
}

export function missingAssessmentArtifactTypes(
  artifacts: { artifactType: AssessmentArtifactType }[]
): AssessmentArtifactType[] {
  const present = new Set(artifacts.map((a) => a.artifactType))
  return REQUIRED_ASSESSMENT_ARTIFACT_TYPES.filter((t) => !present.has(t))
}

export function artifactDownloadLabel(artifactType: AssessmentArtifactType): string {
  return ASSESSMENT_ARTIFACT_LABELS[artifactType].replace(/\W+/g, '_')
}
