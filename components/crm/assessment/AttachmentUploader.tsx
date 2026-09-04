'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { inferAssessmentAttachmentKind } from '@/lib/crm/assessment/attachments.shared'
import { uploadTreatmentAssessmentFile } from '@/lib/crm/assessmentUpload.client'

type AttachmentRecord = {
  id: string
  sectionKey: string
  fileName: string
  mimeType: string
}

type AttachmentUploaderProps = {
  clientId: string
  assessmentId: string
  sectionKey: string
  /** Fixed kind, or auto-detect PDF vs image from the selected file. */
  kind: 'IMAGE' | 'PDF' | 'AUTO'
  accept: string
  multiple?: boolean
  attachments: AttachmentRecord[]
  readOnly?: boolean
  onUploaded: () => void
  label?: string
  hint?: string
}

export function AttachmentUploader({
  clientId,
  assessmentId,
  sectionKey,
  kind,
  accept,
  multiple,
  attachments,
  readOnly,
  onUploaded,
  label = 'Upload file',
  hint,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const sectionAttachments = attachments.filter((a) => a.sectionKey === sectionKey)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || readOnly) return
    setError(null)
    setUploading(true)
    try {
      const list = multiple ? Array.from(files) : [files[0]]
      for (const file of list) {
        const resolvedKind =
          kind === 'AUTO' ? inferAssessmentAttachmentKind(file) : kind
        if (!resolvedKind) {
          throw new Error('Only PDF or image files are allowed (up to 50 MB)')
        }
        await uploadTreatmentAssessmentFile({
          clientId,
          assessmentId,
          sectionKey,
          kind: resolvedKind,
          file,
          onProgress: (p) => setProgress(Math.round((p.loaded / p.total) * 100)),
        })
      }
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? `Uploading ${progress}%…` : label}
          </Button>
          {hint && <p className="text-xs text-quiet">{hint}</p>}
        </>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {sectionAttachments.length > 0 && (
        <ul className="space-y-1 text-sm">
          {sectionAttachments.map((a) => (
            <li key={a.id}>
              <a
                href={`/api/client-services/clients/${clientId}/assessments/attachments/${a.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                {a.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
