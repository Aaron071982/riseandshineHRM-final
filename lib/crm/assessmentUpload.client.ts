'use client'

export type AssessmentUploadProgress = {
  loaded: number
  total: number
}

export async function uploadTreatmentAssessmentFile(input: {
  clientId: string
  assessmentId: string
  sectionKey: string
  kind: 'IMAGE' | 'PDF'
  file: File
  onProgress?: (p: AssessmentUploadProgress) => void
}): Promise<{ attachmentId: string; storagePath: string }> {
  const uploadUrlRes = await fetch(
    `/api/client-services/clients/${input.clientId}/assessments/${input.assessmentId}/upload-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionKey: input.sectionKey,
        kind: input.kind,
        fileName: input.file.name,
        contentType: input.file.type || 'application/octet-stream',
        sizeBytes: input.file.size,
      }),
    }
  )
  if (!uploadUrlRes.ok) {
    const err = await uploadUrlRes.json().catch(() => ({}))
    throw new Error(err.error || 'Could not prepare upload')
  }
  const { signedUrl, storagePath, contentType } = await uploadUrlRes.json()

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    if (input.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          input.onProgress!({ loaded: e.loaded, total: e.total })
        }
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error('Upload to storage failed'))
    }
    xhr.onerror = () => reject(new Error('Upload to storage failed'))
    xhr.send(input.file)
  })

  const attachRes = await fetch(
    `/api/client-services/clients/${input.clientId}/assessments/${input.assessmentId}/attach`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionKey: input.sectionKey,
        kind: input.kind,
        storagePath,
        fileName: input.file.name,
        mimeType: input.file.type || 'application/octet-stream',
        sizeBytes: input.file.size,
      }),
    }
  )
  if (!attachRes.ok) {
    const err = await attachRes.json().catch(() => ({}))
    throw new Error(err.error || 'Could not attach file')
  }
  const data = await attachRes.json()
  return { attachmentId: data.attachmentId, storagePath: data.storagePath }
}
