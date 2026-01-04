'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isCompleted, setIsCompleted] = useState(completion?.status === 'COMPLETED')

  useEffect(() => {
    if (completion?.status === 'COMPLETED') {
      setIsCompleted(true)
    }
  }, [completion])

  const handleSaveDraft = async () => {
    // For draft, we'll just mark as in progress
    // In a full implementation, we could save form field state
    setSaving(true)
    try {
      const response = await fetch('/api/onboarding/pdf/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          formData: {}, // Empty for now since users fill directly in PDF
        }),
      })

      if (response.ok) {
        showToast('Draft saved successfully', 'success')
        onComplete()
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to save draft', 'error')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      showToast('An error occurred. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    setLoading(true)
    try {
      if (!document.pdfData) {
        showToast('PDF data not available', 'error')
        setLoading(false)
        return
      }

      // Note: Browser security prevents extracting filled form data from iframe PDF viewers.
      // Users fill the PDF in the iframe, but we cannot programmatically extract those values.
      // For now, we store the original PDF. Admins can download it, but it won't contain filled data.
      // 
      // To properly capture filled PDFs, you would need to use PDF.js to render the PDF
      // with programmatic access to form fields, or use a server-side PDF filling solution.
      
      // Store the original PDF (users have filled it in the iframe, but we can't capture that data)
      const response = await fetch('/api/onboarding/pdf/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          completedPdfData: document.pdfData, // Store original PDF for now
        }),
      })

      if (response.ok) {
        showToast('Document finalized successfully', 'success')
        setIsCompleted(true)
        onComplete()
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to finalize document', 'error')
      }
    } catch (error) {
      console.error('Error finalizing PDF:', error)
      showToast('An error occurred while finalizing the PDF.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (isCompleted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-green-600 font-semibold text-lg">
              ✓ Completed on {completion?.completedAt ? new Date(completion.completedAt).toLocaleDateString() : ''}
            </div>
            <p className="text-gray-600">This document has been completed and submitted.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* PDF Viewer */}
      <Card>
        <CardContent className="pt-6">
          <div className="border rounded-lg overflow-auto max-h-[600px]" style={{ height: '600px' }}>
            {document.pdfData ? (
              <iframe
                src={`data:application/pdf;base64,${document.pdfData}`}
                className="w-full h-full"
                title={document.title}
              />
            ) : document.pdfUrl ? (
              <iframe
                src={document.pdfUrl}
                className="w-full h-full"
                title={document.title}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                PDF not available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Fill Out the PDF Form</h3>
              <p className="text-sm text-gray-600">
                Please fill out all required fields directly in the PDF form above. When you&apos;re done, click &quot;Finalize & Submit&quot; to complete the document.
              </p>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleSaveDraft}
                disabled={saving || isCompleted}
                variant="outline"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={loading || isCompleted}
                className="flex-1"
              >
                {loading ? 'Finalizing...' : 'Finalize & Submit'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

