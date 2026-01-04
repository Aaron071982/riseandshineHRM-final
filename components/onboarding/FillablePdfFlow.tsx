'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'
import { usePdfFormFiller } from './PdfFormFiller'

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
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (completion?.status === 'COMPLETED') {
      setIsCompleted(true)
    }
  }, [completion])

  // Always call hook (React rules), but it handles empty pdfData gracefully
  const pdfFiller = usePdfFormFiller(document.pdfData || '')

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      let filledPdfBase64 = document.pdfData || ''
      
      // If we have form data from the PDF filler, use it
      if (!pdfFiller.loading && document.pdfData) {
        try {
          filledPdfBase64 = await pdfFiller.getFilledPdf()
        } catch (error) {
          console.error('Error getting filled PDF:', error)
          // Fallback to original PDF
        }
      }
      
      const response = await fetch('/api/onboarding/pdf/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          formData: pdfFiller.formData || {},
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

      // Get filled PDF using the PDF form filler
      let filledPdfBase64 = document.pdfData
      if (!pdfFiller.loading && document.pdfData) {
        try {
          filledPdfBase64 = await pdfFiller.getFilledPdf()
        } catch (error) {
          console.error('Error generating filled PDF:', error)
          showToast('Warning: Could not capture filled form data. Storing original PDF.', 'error')
          // Continue with original PDF as fallback
        }
      }

      const response = await fetch('/api/onboarding/pdf/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          completedPdfData: filledPdfBase64,
        }),
      })

      if (response.ok) {
        showToast('Document finalized successfully', 'success')
        setIsCompleted(true)
        onComplete() // Only refresh on finalize
      } else {
        const error = await response.json()
        showToast(error.error || 'Failed to finalize document', 'error')
      }
    } catch (error) {
      console.error('Error finalizing PDF:', error)
      showToast('An error occurred while finalizing the PDF. Please try again.', 'error')
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
                ref={iframeRef}
                src={`data:application/pdf;base64,${document.pdfData}#toolbar=1`}
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

      {/* Form Fields (if PDF has form fields) */}
      {!pdfFiller.loading && pdfFiller.formFields.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Fill Out Form Fields</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pdfFiller.formFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>{field.name}</Label>
                    {field.type === 'PDFTextField' && (
                      <Input
                        id={field.name}
                        value={pdfFiller.formData[field.name] || ''}
                        onChange={(e) => pdfFiller.updateField(field.name, e.target.value)}
                        disabled={isCompleted}
                      />
                    )}
                    {field.type === 'PDFCheckBox' && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={field.name}
                          checked={pdfFiller.formData[field.name] || false}
                          onCheckedChange={(checked) => pdfFiller.updateField(field.name, checked)}
                          disabled={isCompleted}
                        />
                        <Label htmlFor={field.name} className="cursor-pointer">
                          {field.name}
                        </Label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Fill Out the PDF Form</h3>
              <p className="text-sm text-gray-600">
                {!pdfFiller.loading && pdfFiller.formFields.length > 0
                  ? 'Fill out the form fields below. You can also fill directly in the PDF viewer above. When you\'re done, click "Finalize & Submit" to complete the document.'
                  : 'Please fill out all required fields directly in the PDF form above. When you\'re done, click "Finalize & Submit" to complete the document.'}
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

