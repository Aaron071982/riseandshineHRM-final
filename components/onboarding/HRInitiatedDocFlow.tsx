'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Lock, Download, CheckCircle2, Clock, Loader2 } from 'lucide-react'

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: string
  pdfUrl: string | null
}

interface Completion {
  id: string
  documentId: string
  status: string
  completedAt: string | null
}

interface HRDocumentTask {
  id: string
  rbtProfileId: string
  documentType: string
  status: 'PENDING_HR' | 'PENDING_BT' | 'PENDING_HR_SIGNOFF' | 'COMPLETE'
  hrFileUrl: string | null
  btFileUrl: string | null
}

interface HRInitiatedDocFlowProps {
  document: OnboardingDocument
  completion: Completion | undefined
  hrTask: HRDocumentTask | undefined
  onComplete: () => void
  onHrTaskUpdated?: (task: HRDocumentTask) => void
}

export default function HRInitiatedDocFlow({
  document,
  hrTask,
  onHrTaskUpdated,
}: HRInitiatedDocFlowProps) {
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [localTask, setLocalTask] = useState(hrTask)

  const task = localTask ?? hrTask
  const status = task?.status ?? 'PENDING_HR'

  const handleDownloadHrFile = () => {
    if (!task?.hrFileUrl) {
      showToast('HR file is not available yet', 'error')
      return
    }
    window.location.href = `/api/hr-tasks/${task.id}/hr-file`
  }

  const handleUpload = async (file: File) => {
    if (!task) {
      showToast('HR task not found', 'error')
      return
    }
    if (file.type !== 'application/pdf') {
      showToast('Please upload a PDF file', 'error')
      return
    }
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      showToast('File size must be less than 10MB', 'error')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('documentId', document.id)
      formData.append('filledPdf', file)

      const uploadRes = await fetch('/api/onboarding/pdf/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json().catch(() => ({}))
      if (!uploadRes.ok) {
        showToast(uploadData.error || 'Upload failed', 'error')
        return
      }

      const btFileUrl =
        typeof uploadData.storagePath === 'string'
          ? uploadData.storagePath
          : uploadData.completion?.signedPdfUrl

      if (!btFileUrl) {
        showToast('Upload succeeded but file path was missing', 'error')
        return
      }

      const btRes = await fetch(`/api/hr-tasks/${task.id}/bt-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ btFileUrl }),
      })
      const btData = await btRes.json().catch(() => ({}))
      if (!btRes.ok) {
        showToast(btData.error || 'Could not record upload for HR review', 'error')
        return
      }

      const updated = btData.hrTask as HRDocumentTask
      setLocalTask(updated)
      onHrTaskUpdated?.(updated)
      showToast('Submitted for HR review', 'success')
    } catch {
      showToast('Something went wrong', 'error')
    } finally {
      setUploading(false)
    }
  }

  if (!task || status === 'PENDING_HR') {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-6 text-center space-y-3">
        <Lock className="w-10 h-10 mx-auto text-slate-400" />
        <h3 className="font-semibold text-slate-900 dark:text-[var(--text-primary)]">Pending from HR</h3>
        <p className="text-sm text-slate-600 dark:text-[var(--text-secondary)] max-w-md mx-auto">
          Your {document.title} is being prepared by the Rise & Shine HR team. You&apos;ll be notified when
          it&apos;s ready for your review and signature.
        </p>
      </div>
    )
  }

  if (status === 'PENDING_BT') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-[var(--text-secondary)]">
          HR has prepared your {document.title}. Please download, review, sign, and upload your completed copy
          below.
        </p>
        <Button type="button" variant="outline" onClick={handleDownloadHrFile} disabled={!task.hrFileUrl}>
          <Download className="w-4 h-4 mr-2" />
          Download HR-prepared document
        </Button>
        <div>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#e36f1e] file:text-white"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ''
            }}
          />
        </div>
        {uploading && (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading…
          </p>
        )}
      </div>
    )
  }

  if (status === 'PENDING_HR_SIGNOFF') {
    return (
      <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-950/25 p-6 text-center space-y-3">
        <Clock className="w-10 h-10 mx-auto text-blue-500" />
        <p className="text-sm text-slate-700 dark:text-[var(--text-secondary)]">
          You&apos;ve submitted your {document.title}. HR is reviewing your submission.
        </p>
      </div>
    )
  }

  if (status === 'COMPLETE') {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/80 dark:bg-green-950/25 p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 dark:text-green-400" />
        <p className="text-sm text-slate-700 dark:text-[var(--text-secondary)]">
          Your {document.title} has been verified by HR.
        </p>
      </div>
    )
  }

  return null
}
