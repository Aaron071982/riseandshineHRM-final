'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface PdfAcroFormViewerProps {
  pdfData: string // base64 encoded PDF
  requiredFields?: string[]
  onFinalize?: (args: { fieldValues: Record<string, any>; filledPdfBlob: Blob }) => Promise<void>
  onSaveDraft?: (args: { fieldValues: Record<string, any> }) => Promise<void>
  readOnly?: boolean
  documentTitle?: string
}

export default function PdfAcroFormViewer({
  pdfData,
  requiredFields = [],
  onFinalize,
  onSaveDraft,
  readOnly = false,
  documentTitle = 'PDF Document',
}: PdfAcroFormViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => {
    if (!pdfData || pdfData.length === 0) {
      setError('PDF data not available')
      setLoading(false)
      return
    }

    loadPdf()

    // Store ref value for cleanup
    const container = containerRef.current

    return () => {
      // Cleanup polling interval and blob URL
      if (container) {
        if ((container as any).__pollInterval) {
          clearInterval((container as any).__pollInterval)
        }
        if ((container as any).__pdfBlobUrl) {
          URL.revokeObjectURL((container as any).__pdfBlobUrl)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData])

  const loadPdf = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!containerRef.current) {
        setLoading(false)
        return
      }

      // Clear container
      containerRef.current.innerHTML = ''

      // Decode base64 PDF and create blob URL for iframe
      const binaryString = atob(pdfData)
      const pdfBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i)
      }
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      // Create iframe for native browser PDF viewer (supports interactive form fields)
      const iframe = document.createElement('iframe')
      iframe.src = `${url}#toolbar=1`
      iframe.style.width = '100%'
      iframe.style.height = '800px'
      iframe.style.border = '1px solid #e5e7eb'
      iframe.style.borderRadius = '8px'
      iframe.style.backgroundColor = '#fff'
      iframe.setAttribute('title', documentTitle || 'PDF Document')

      // Store blob URL for cleanup
      ;(containerRef.current as any).__pdfBlobUrl = url
      ;(containerRef.current as any).__pdfIframe = iframe

      containerRef.current.appendChild(iframe)

      // Extract form fields from PDF using pdf-lib for field discovery (optional)
      // This helps us know which fields exist for validation
      try {
        const { PDFDocument } = await import('pdf-lib')
        const pdfLibDoc = await PDFDocument.load(pdfBytes)
        const form = pdfLibDoc.getForm()
        const fields = form.getFields()

        // Store field names for validation (if needed)
        const fieldNames = fields.map((f) => f.getName())
        if (fieldNames.length > 0) {
          // Fields exist - can use for validation later if needed
        }
      } catch (err) {
        console.warn('Could not extract form fields (this is okay):', err)
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Error loading PDF:', err)
      setError(err.message || 'Failed to load PDF')
      setLoading(false)
    }
  }

  const loadFieldValues = async () => {
    // With iframe approach, we can't directly access filled values due to CORS
    // Values will be extracted on finalize if possible, or user will need to manually fill
    // This is a limitation of iframe approach, but ensures PDF is visible and fillable
  }

  const validateFields = (): boolean => {
    if (requiredFields.length === 0) return true

    const missing: string[] = []
    for (const fieldName of requiredFields) {
      const value = fieldValues[fieldName]
      if (value === undefined || value === null || value === '' || value === false) {
        missing.push(fieldName)
      }
    }

    if (missing.length > 0) {
      setValidationErrors(missing)
      // Highlight missing fields (add red border to annotation widgets)
      if (containerRef.current) {
        const widgets = containerRef.current.querySelectorAll('.annotationLayer [data-field-name]')
        widgets.forEach((widget: any) => {
          if (missing.includes(widget.dataset.fieldName)) {
            widget.style.border = '2px solid red'
            widget.style.borderRadius = '2px'
          }
        })
      }
      return false
    }

    setValidationErrors([])
    return true
  }

  const generateFilledPdf = async (): Promise<Blob> => {
    // With iframe approach, we can't extract filled values due to CORS restrictions
    // We'll use pdf-lib to fill with whatever field values we have
    // If fieldValues is empty, the original PDF will be sent (user can fill manually later if needed)

    // Import the fill utility
    const { fillPdfWithValues } = await import('@/lib/pdf/fillPdfWithValues')

    // Get original PDF bytes
    const binaryString = atob(pdfData)
    const pdfBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      pdfBytes[i] = binaryString.charCodeAt(i)
    }

    // Generate filled PDF with current field values (may be empty)
    // Note: This is a limitation - ideally we'd extract from iframe, but CORS prevents it
    const filledBlob = await fillPdfWithValues(pdfBytes, fieldValues)
    return filledBlob
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return

    try {
      setSaving(true)
      loadFieldValues() // Refresh field values
      await onSaveDraft({ fieldValues })
    } catch (err: any) {
      console.error('Error saving draft:', err)
      setError(err.message || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    if (!onFinalize) return

    // Validate required fields
    if (!validateFields()) {
      setError(`Please fill in all required fields: ${validationErrors.join(', ')}`)
      return
    }

    try {
      setFinalizing(true)
      setError(null)
      loadFieldValues() // Refresh field values

      // Generate filled PDF
      const filledPdfBlob = await generateFilledPdf()

      // Call finalize callback
      await onFinalize({ fieldValues, filledPdfBlob })
    } catch (err: any) {
      console.error('Error finalizing PDF:', err)
      setError(err.message || 'Failed to finalize PDF')
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <span className="ml-2 text-gray-600">Loading PDF...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600 py-12">
            <p>Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* PDF Viewer Container */}
      <Card>
        <CardContent className="pt-6">
          <div
            ref={containerRef}
            className="pdf-container overflow-auto max-h-[800px] border border-gray-200 rounded-lg p-4 bg-gray-50"
            style={{ minHeight: '400px' }}
          />
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-red-600">
              <p className="font-semibold mb-2">Please fill in all required fields:</p>
              <ul className="list-disc list-inside">
                {validationErrors.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!readOnly && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              {onSaveDraft && (
                <Button
                  onClick={handleSaveDraft}
                  disabled={saving || finalizing}
                  variant="outline"
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
              )}
              {onFinalize && (
                <Button
                  onClick={handleFinalize}
                  disabled={saving || finalizing}
                  className="flex-1"
                >
                  {finalizing ? 'Finalizing...' : 'Finalize & Submit'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

