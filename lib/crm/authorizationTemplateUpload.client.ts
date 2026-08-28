import { validateAuthTemplateFile } from '@/lib/crm/authorizationTemplate.shared'

export type AuthTemplateUploadErrorCode =
  | 'validation'
  | 'auth'
  | 'network'
  | 'server'

export class AuthTemplateUploadError extends Error {
  readonly code: AuthTemplateUploadErrorCode

  constructor(message: string, code: AuthTemplateUploadErrorCode) {
    super(message)
    this.name = 'AuthTemplateUploadError'
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
): AuthTemplateUploadError {
  if (status === 403) {
    return new AuthTemplateUploadError(
      'You are not authorized to upload authorization templates for this client',
      'auth'
    )
  }
  if (status === 400) {
    return new AuthTemplateUploadError(data.error || 'Invalid file', 'validation')
  }
  if (status === 413) {
    return new AuthTemplateUploadError(
      data.error || 'File must be 25 MB or smaller',
      'validation'
    )
  }
  return new AuthTemplateUploadError(data.error || fallback, 'server')
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
        new AuthTemplateUploadError(
          `Storage upload failed (${xhr.status}). Check your connection and try again.`,
          'network'
        )
      )
    })
    xhr.addEventListener('error', () => {
      reject(new AuthTemplateUploadError('Network error during upload', 'network'))
    })
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

export async function uploadAuthorizationTemplate(
  clientId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  const check = validateAuthTemplateFile({
    name: file.name,
    size: file.size,
    type: file.type,
  })
  if (!check.ok) {
    throw new AuthTemplateUploadError(check.error, 'validation')
  }

  const urlRes = await fetch(
    `/api/client-services/clients/${clientId}/authorization-template/upload-url`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }),
    }
  )
  const urlData = (await urlRes.json().catch(() => ({}))) as UploadUrlResponse
  if (!urlRes.ok) {
    throw mapApiError(urlRes.status, urlData, 'Could not prepare upload')
  }

  await putFileWithProgress(
    urlData.signedUrl,
    file,
    urlData.contentType || file.type || 'application/octet-stream',
    onProgress
  )

  const attachRes = await fetch(
    `/api/client-services/clients/${clientId}/authorization-template/attach`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storagePath: urlData.storagePath,
        fileName: file.name,
        contentType: urlData.contentType || file.type,
        sizeBytes: file.size,
      }),
    }
  )
  const attachData = (await attachRes.json().catch(() => ({}))) as {
    error?: string
  }
  if (!attachRes.ok) {
    throw mapApiError(attachRes.status, attachData, 'Could not save upload')
  }
}
