'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export default function DocumentUploadFlow({
  documentId,
  title,
  description,
  externalCourseUrl,
  externalCourseLabel,
  onComplete,
}: {
  documentId: string
  title: string
  description?: string
  /** When set, shows a link to complete training before uploading (e.g. 40-hour RBT course). */
  externalCourseUrl?: string
  externalCourseLabel?: string
  onComplete: () => void
}) {
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const upload = async () => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showToast('File must be under 10MB', 'error')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/rbt/onboarding/documents/${documentId}/upload`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Upload failed', 'error')
        return
      }
      showToast('Upload complete', 'success')
      onComplete()
    } catch {
      showToast('Upload failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-sm text-gray-600 dark:text-[var(--text-secondary)]">{description}</p>}

      {externalCourseUrl && (
        <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
          <p className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
            Start the free 40-hour RBT training course below. You can return here anytime to upload your certificate
            of completion after you finish — you do not need to complete the course in one sitting.
          </p>
          <Button asChild className="bg-[#e36f1e] hover:bg-[#c75f18]">
            <a href={externalCourseUrl} target="_blank" rel="noopener noreferrer">
              {externalCourseLabel ?? 'Start 40-Hour RBT Course'}
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
          <p className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">
            Opens Autism Partnership Foundation&apos;s free RBT Training 2.0 in a new tab.
          </p>
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium text-gray-800 dark:text-[var(--text-primary)]">
          {externalCourseUrl ? 'When you have your certificate, upload it here' : 'Upload your file'}
        </p>
        <p className="text-sm text-gray-500">PDF, JPG, or PNG — max 10MB</p>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png"
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#e36f1e] file:text-white"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={upload} disabled={!file || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          Upload certificate
        </Button>
      </div>
    </div>
  )
}
