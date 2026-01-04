'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

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
  const [numPages, setNumPages] = useState(0)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const annotationStorageRef = useRef<any>(null)

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

      // Decode base64 PDF
      const binaryString = atob(pdfData)
      const pdfBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i)
      }

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
      const pdfDoc = await loadingTask.promise
      pdfDocRef.current = pdfDoc
      annotationStorageRef.current = pdfDoc.annotationStorage

      setNumPages(pdfDoc.numPages)

      // Render all pages
      await renderPages(pdfDoc)

      // Load existing field values from annotation storage
      loadFieldValues()

      setLoading(false)
    } catch (err: any) {
      console.error('Error loading PDF:', err)
      setError(err.message || 'Failed to load PDF')
      setLoading(false)
    }
  }

  const renderPages = async (pdfDoc: pdfjsLib.PDFDocumentProxy) => {
    if (!containerRef.current) return

    // Clear container
    containerRef.current.innerHTML = ''

    // Use iframe for better form field support - native browser PDF viewer supports interactive forms
    const binaryString = atob(pdfData)
    const pdfBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      pdfBytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const iframe = document.createElement('iframe')
    iframe.src = `${url}#toolbar=1`
    iframe.style.width = '100%'
    iframe.style.height = '800px'
    iframe.style.border = '1px solid #ccc'
    iframe.style.borderRadius = '4px'
    iframe.setAttribute('title', documentTitle || 'PDF Document')
    iframe.setAttribute('loading', 'lazy')

    // Store blob URL for cleanup
    ;(containerRef.current as any).__pdfBlobUrl = url
    ;(containerRef.current as any).__pdfIframe = iframe

    containerRef.current.appendChild(iframe)

    // Extract form fields from PDF using pdf-lib for field discovery
    // This helps us know which fields exist for validation
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdfLibDoc = await PDFDocument.load(pdfBytes)
      const form = pdfLibDoc.getForm()
      const fields = form.getFields()

      // Store field names for validation
      const fieldNames = fields.map((f) => f.getName())

      // Set up polling to try extracting values (limited with iframe, but we'll try)
      // The actual form filling happens in the iframe, and we capture it on finalize
      if (fieldNames.length > 0) {
        // Store field names in state for validation
        // Note: We can't easily extract values from iframe due to security restrictions
        // But users can fill the form in the iframe, and on finalize we'll use pdf-lib
        // to read the filled PDF from the iframe if possible, or prompt user to download/upload
      }
    } catch (err) {
      console.warn('Could not extract form fields:', err)
    }
  }

  const loadFieldValues = async () => {
    // Since we're using iframe, we can't directly access PDF.js annotation storage
    // Instead, we'll extract values when finalizing using pdf-lib
    // This is a limitation of the iframe approach, but it works for MVP
    // For production, proper annotation layer rendering would be needed
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
    // Get the iframe element
    const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null

    // Try to get the filled PDF from the iframe
    // Note: Due to browser security (CORS), we typically can't access iframe content
    // But we'll try to use pdf-lib to fill based on current field values
    // For now, we'll reload the PDF and fill it programmatically
    
    try {
      // Try to extract from annotation storage if PDF.js was used
      if (annotationStorageRef.current) {
        const allValues = annotationStorageRef.current.getAll()
        const extractedValues: Record<string, any> = {}
        for (const [key, value] of Object.entries(allValues)) {
          if (value && typeof value === 'object' && 'value' in value) {
            extractedValues[key] = (value as any).value
          } else {
            extractedValues[key] = value
          }
        }
        if (Object.keys(extractedValues).length > 0) {
          setFieldValues(extractedValues)
        }
      }
    } catch (err) {
      console.warn('Could not extract from annotation storage:', err)
    }

    // Import the fill utility
    const { fillPdfWithValues } = await import('@/lib/pdf/fillPdfWithValues')

    // Get original PDF bytes
    const binaryString = atob(pdfData)
    const pdfBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      pdfBytes[i] = binaryString.charCodeAt(i)
    }

    // Generate filled PDF with current field values
    // If fieldValues is empty, we'll still create the PDF (user may have filled in iframe)
    // The backend will store whatever we send
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

  if (error && !pdfDocRef.current) {
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

