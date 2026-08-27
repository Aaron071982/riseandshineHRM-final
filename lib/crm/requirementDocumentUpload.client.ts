import { validateRequirementDocumentFile } from '@/lib/crm/requirementDocuments'

export type RequirementUploadErrorCode =
  | 'validation'
  | 'auth'
  | 'network'
  | 'server'

export class RequirementUploadError extends Error {
  readonly code: RequirementUploadErrorCode

  constructor(message: string, code: RequirementUploadErrorCode) {
    super(message)
    this.name = 'RequirementUploadError'
    this.code = code
  }
}

type UploadUrlResponse = {
  signedUrl: string
  storagePath: string
  contentType: string
  error?: string
}

function mapApiError(
  status: number,
  data: { error?: string },
  fallback: string
): RequirementUploadError {
  if (status === 403) {
    return new RequirementUploadError(
      'You are not authorized to upload documents for this client',
      'auth'
    )
  }
  if (status === 404) {
    return new RequirementUploadError(
      data.error || 'Document requirement not found',
      'server'
    )
  }
  if (status === 400) {
    return new RequirementUploadError(data.error || 'Invalid file', 'validation')
  }
  if (status === 413) {
    return new RequirementUploadError(
      data.error || 'File must be 25 MB or smaller',
      'validation'
    )
  }
  return new RequirementUploadError(data.error || fallback, 'server')
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
        new RequirementUploadError(
          `Storage upload failed (${xhr.status}). Check your connection and try again.`,
          'network'
        )
      )
    })
    xhr.addEventListener('error', () => {
      reject(
        new RequirementUploadError(
          'Network error while uploading — check your connection and try again',
          'network'
        )
      )
    })
    xhr.addEventListener('abort', () => {
      reject(new RequirementUploadError('Upload cancelled', 'network'))
    })
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

/** Browser → Supabase direct upload (bypasses Vercel 4.5 MB body limit). */
export async function uploadRequirementDocumentDirect(input: {
  clientId: string
  requirementId: string
  file: File
  onProgress?: (pct: number) => void
}): Promise<void> {
  const { clientId, requirementId, file, onProgress } = input

  const check = validateRequirementDocumentFile({
    name: file.name,
    size: file.size,
    type: file.type,
  })
  if (!check.ok) {
    throw new RequirementUploadError(check.error, 'validation')
  }

  onProgress?.(0)

  const contentType = file.type || 'application/octet-stream'
  const urlRes = await fetch(
    `/api/client-services/clients/${clientId}/requirements/${requirementId}/upload-url`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      }),
    }
  )
  const urlData = (await urlRes.json().catch(() => ({}))) as UploadUrlResponse
  if (!urlRes.ok) {
    throw mapApiError(urlRes.status, urlData, 'Could not start upload')
  }
  if (!urlData.signedUrl || !urlData.storagePath) {
    throw new RequirementUploadError('Invalid upload response from server', 'server')
  }

  await putFileWithProgress(
    urlData.signedUrl,
    file,
    urlData.contentType || contentType,
    onProgress
  )

  const attachRes = await fetch(
    `/api/client-services/clients/${clientId}/requirements/${requirementId}/attach`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storagePath: urlData.storagePath,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      }),
    }
  )
  const attachData = (await attachRes.json().catch(() => ({}))) as { error?: string }
  if (!attachRes.ok) {
    throw mapApiError(attachRes.status, attachData, 'Could not attach uploaded file')
  }
}
