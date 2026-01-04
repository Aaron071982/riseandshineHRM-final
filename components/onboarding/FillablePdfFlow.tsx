'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import PdfAcroFormViewer from '@/components/pdf/PdfAcroFormViewer'

interface OnboardingDocument {
  id: string
  title: string
  slug: string
  type: 'ACKNOWLEDGMENT' | 'FILLABLE_PDF'
  pdfUrl: string | null
  pdfData: string | null
}

interface Completion {
  id: string
  documentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
  draftData?: any
}

interface FillablePdfFlowProps {
  document: OnboardingDocument
  completion: Completion | undefined
  onComplete: () => void
}

export default function FillablePdfFlow({
  document,
  completion,
  onComplete,
}: FillablePdfFlowProps) {
  const { showToast } = useToast()
  const [isCompleted, setIsCompleted] = useState(completion?.status === 'COMPLETED')

  useEffect(() => {
    if (completion?.status === 'COMPLETED') {
      setIsCompleted(true)
    }
  }, [completion])

  const handleSaveDraft = async ({ fieldValues }: { fieldValues: Record<string, any> }) => {
    try {
      const response = await fetch('/api/onboarding/pdf/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          fieldValues: fieldValues,
        }),
      })

      if (response.ok) {
        showToast('Draft saved successfully', 'success')
        // Don't call onComplete() to avoid refresh - preserves form state
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to save draft', 'error')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      showToast('An error occurred while saving. Your form data may not be saved.', 'error')
    }
  }

  const handleFinalize = async ({
    fieldValues,
    filledPdfBlob,
  }: {
    fieldValues: Record<string, any>
    filledPdfBlob: Blob
  }) => {
    try {
      // Create FormData to upload the filled PDF
      const formData = new FormData()
      formData.append('documentId', document.id)
      formData.append('filledPdf', filledPdfBlob, `${document.slug}.pdf`)
      formData.append('fieldValues', JSON.stringify(fieldValues))

      const response = await fetch('/api/onboarding/pdf/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        showToast('Document finalized successfully', 'success')
        setIsCompleted(true)
        onComplete() // Refresh to show completion status
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to finalize document', 'error')
        throw new Error(error.error || 'Failed to finalize document')
      }
    } catch (error) {
      console.error('Error finalizing PDF:', error)
      showToast('An error occurred while finalizing the PDF. Please try again.', 'error')
      throw error
    }
  }

  if (isCompleted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-green-600 font-semibold text-lg">
              ✓ Completed on{' '}
              {completion?.completedAt
                ? new Date(completion.completedAt).toLocaleDateString()
                : ''}
            </div>
            <p className="text-gray-600">This document has been completed and submitted.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  useEffect(() => {
    console.log('[FillablePdfFlow] Document data:', {
      id: document.id,
      title: document.title,
      hasPdfData: !!document.pdfData,
      pdfDataLength: document.pdfData?.length || 0,
    })
  }, [document])

  if (!document.pdfData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 py-12">
            <p className="font-semibold mb-2">PDF not available</p>
            <p className="text-sm">
              The PDF data for this document is missing. Please contact support or try refreshing the page.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <PdfAcroFormViewer
      pdfData={document.pdfData}
      onFinalize={handleFinalize}
      onSaveDraft={handleSaveDraft}
      readOnly={isCompleted}
      documentTitle={document.title}
    />
  )
}
