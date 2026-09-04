import type { AssessmentArtifactType } from '@prisma/client'
import {
  MAX_CLINICAL_ASSESSMENT_BYTES,
  validateClinicalAssessmentFile,
} from '@/lib/crm/clinicalAssessment/artifacts.shared'

export class ClinicalAssessmentUploadError extends Error {
  readonly code: 'validation' | 'auth' | 'network' | 'server'

  constructor(message: string, code: 'validation' | 'auth' | 'network' | 'server') {
    super(message)
    this.name = 'ClinicalAssessmentUploadError'
    this.code = code
  }
}

function mapApiError(
  status: number,
  data: { error?: string },
  fallback: string
): ClinicalAssessmentUploadError {
  if (status === 403) {
    return new ClinicalAssessmentUploadError(
      'You are not authorized to upload clinical assessment artifacts',
      'auth'
    )
  }
  if (status === 400) {
    return new ClinicalAssessmentUploadError(data.error || 'Invalid file', 'validation')
  }
  if (status === 413) {
    return new ClinicalAssessmentUploadError(
      data.error || 'File exceeds size limit',
      'validation'
    )
  }
  return new ClinicalAssessmentUploadError(data.error || fallback, 'server')
}

function putFileWithProgress(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }
      reject(
        new ClinicalAssessmentUploadError(
          `Storage upload failed (${xhr.status})`,
          'network'
        )
      )
    })
    xhr.addEventListener('error', () => {
      reject(new ClinicalAssessmentUploadError('Network error during upload', 'network'))
    })
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

export async function uploadClinicalAssessmentArtifact(
  clientId: string,
  assessmentId: string,
  artifactType: AssessmentArtifactType,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  const check = validateClinicalAssessmentFile({
    artifactType,
    name: file.name,
    size: file.size,
    type: file.type,
  })
  if (!check.ok) {
    throw new ClinicalAssessmentUploadError(check.error, 'validation')
  }
  if (file.size > MAX_CLINICAL_ASSESSMENT_BYTES) {
    throw new ClinicalAssessmentUploadError(
      `File must be ${MAX_CLINICAL_ASSESSMENT_BYTES / (1024 * 1024)} MB or smaller`,
      'validation'
    )
  }

  const urlRes = await fetch(
    `/api/client-services/clients/${clientId}/clinical-assessment/${assessmentId}/upload-url`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }),
    }
  )
  const urlData = (await urlRes.json().catch(() => ({}))) as {
    signedUrl?: string
    storagePath?: string
    contentType?: string
    error?: string
  }
  if (!urlRes.ok || !urlData.signedUrl || !urlData.storagePath) {
    throw mapApiError(urlRes.status, urlData, 'Could not prepare upload')
  }

  await putFileWithProgress(
    urlData.signedUrl,
    file,
    urlData.contentType || file.type || 'application/octet-stream',
    onProgress
  )

  const attachRes = await fetch(
    `/api/client-services/clients/${clientId}/clinical-assessment/${assessmentId}/attach`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifactType,
        storagePath: urlData.storagePath,
        fileName: file.name,
        contentType: urlData.contentType || file.type,
        sizeBytes: file.size,
      }),
    }
  )
  const attachData = (await attachRes.json().catch(() => ({}))) as { error?: string }
  if (!attachRes.ok) {
    throw mapApiError(attachRes.status, attachData, 'Could not save upload')
  }
}
