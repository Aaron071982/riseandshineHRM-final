'use client'

import { useState, useEffect } from 'react'
import FillablePdfFlow from '@/components/onboarding/FillablePdfFlow'
import { useToast } from '@/components/ui/toast'

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
}

interface Completion {
  id: string
  documentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
  downloadedAt?: string | null
  draftData?: unknown
}

interface DownloadReuploadFlowProps {
  document: OnboardingDocument
  completion: Completion | undefined
  onComplete: () => void
  onDownload: () => void
}

/**
 * Wraps FillablePdfFlow: step is only complete after BT has downloaded the blank
 * template and uploaded their filled copy.
 */
export default function DownloadReuploadFlow({
  document,
  completion,
  onComplete,
  onDownload,
}: DownloadReuploadFlowProps) {
  const { showToast } = useToast()
  const [hasDownloaded, setHasDownloaded] = useState(!!completion?.downloadedAt)

  useEffect(() => {
    if (completion?.downloadedAt) {
      setHasDownloaded(true)
    }
  }, [completion?.downloadedAt])

  const handleDownload = () => {
    onDownload()
    setHasDownloaded(true)
  }

  const handleFlowComplete = () => {
    if (!hasDownloaded) {
      showToast('Please download the blank form before marking this step complete', 'error')
      return
    }
    onComplete()
  }

  return (
    <div className="space-y-4">
      {!hasDownloaded && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2">
          Download the blank form first, then fill it out and upload your completed copy below.
        </p>
      )}
      {hasDownloaded && completion?.status !== 'COMPLETED' && (
        <p className="text-sm text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-lg px-3 py-2">
          Download recorded. Upload your completed PDF to finish this step.
        </p>
      )}
      <FillablePdfFlow
        document={document}
        completion={completion}
        onComplete={handleFlowComplete}
        onDownload={handleDownload}
      />
    </div>
  )
}
