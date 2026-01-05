'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

interface FormField {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'textarea'
  value: any
  options?: string[]
}

interface PdfAcroFormViewerProps {
  pdfData: string // base64 encoded PDF
  requiredFields?: string[]
  onFinalize?: (args: { fieldValues: Record<string, any>; filledPdfBlob: Blob }) => Promise<void>
  onSaveDraft?: (args: { fieldValues: Record<string, any> }) => Promise<void>
  readOnly?: boolean
  documentTitle?: string
  documentId?: string // Optional: for stable load key (falls back to documentTitle)
}

export default function PdfAcroFormViewer({
  pdfData,
  requiredFields = [],
  onFinalize,
  onSaveDraft,
  readOnly = false,
  documentTitle = 'PDF Document',
  documentId,
}: PdfAcroFormViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const loadedKeyRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  useEffect(() => {
    if (!pdfData || pdfData.length === 0) {
      console.error('[PdfAcroFormViewer] PDF data is empty or missing')
      setError('PDF data not available. Please contact support.')
      setLoading(false)
      return
    }

    // Create stable load key that changes only when document truly changes
    const loadKey = `${documentId || documentTitle}:${pdfData.length}`

    // Check if already loaded
    if (loadedKeyRef.current === loadKey) {
      console.log('[PdfAcroFormViewer] PDF already loaded for this document')
      setLoading(false)
      return
    }

    // Check if currently loading
    if (loadingRef.current) {
      console.log('[PdfAcroFormViewer] PDF load already in progress')
      return
    }

    // Reset retry count for new document
    retryCountRef.current = 0

    // Set loading guard
    loadingRef.current = true
    setLoading(true)
    setError(null)

    console.log('[PdfAcroFormViewer] Starting PDF load for key:', loadKey)

    // Function to attempt loading
    const attemptLoad = () => {
      const container = containerRef.current
      if (!container) {
        retryCountRef.current++
        if (retryCountRef.current > 20) {
          // Max 20 retries (1 second total)
          console.error('[PdfAcroFormViewer] Container not available after max retries')
          setError('PDF viewer container not available. Please refresh the page.')
          loadingRef.current = false
          setLoading(false)
          return
        }
        console.log(`[PdfAcroFormViewer] Container not yet available, retry ${retryCountRef.current}/20`)
        // Retry after a short delay
        retryTimeoutRef.current = setTimeout(() => {
          if (loadingRef.current && loadedKeyRef.current !== loadKey) {
            attemptLoad()
          }
        }, 50)
        return
      }

      // Container is available, proceed with loading
      retryCountRef.current = 0

      // Use requestAnimationFrame to ensure layout has settled
      requestAnimationFrame(async () => {
        try {
          await loadPdf()
          loadedKeyRef.current = loadKey
          console.log('[PdfAcroFormViewer] PDF loaded successfully')
        } catch (err: any) {
          console.error('[PdfAcroFormViewer] Error loading PDF:', err)
          setError(err.message || 'Failed to load PDF')
          // Don't set loadedKeyRef on error so it can retry
        } finally {
          loadingRef.current = false
          setLoading(false)
        }
      })
    }

    // Start attempt - use requestAnimationFrame to wait for next frame
    requestAnimationFrame(() => {
      attemptLoad()
    })

    // Cleanup function
    return () => {
      loadingRef.current = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // Cleanup blob URLs
      const container = containerRef.current
      if (container) {
        if ((container as any).__pdfBlobUrl) {
          URL.revokeObjectURL((container as any).__pdfBlobUrl)
        }
      }
    }
  }, [pdfData, documentId || documentTitle])

  const loadPdf = async () => {
    // Container and pdfData checks are done in useEffect
    if (!containerRef.current || !pdfData || pdfData.length === 0) {
      throw new Error('Container or PDF data not available')
    }

    try {
      console.log('[PdfAcroFormViewer] Loading PDF, data length:', pdfData.length)

      // Decode base64 PDF
      const binaryString = atob(pdfData)
      const pdfBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i)
      }
      console.log('[PdfAcroFormViewer] PDF bytes decoded, length:', pdfBytes.length)

      // Validate PDF bytes (should start with PDF magic bytes)
      if (pdfBytes.length < 4 || pdfBytes[0] !== 0x25 || pdfBytes[1] !== 0x50 || pdfBytes[2] !== 0x44 || pdfBytes[3] !== 0x46) {
        console.warn('[PdfAcroFormViewer] PDF bytes do not start with PDF magic bytes - may not be valid PDF')
      } else {
        console.log('[PdfAcroFormViewer] PDF bytes validated - valid PDF structure detected')
      }

      // Use data URL iframe first - most reliable for displaying PDFs
      console.log('[PdfAcroFormViewer] Using data URL iframe for display (most reliable)')
      await renderPdfWithDataUrl(pdfData)

      // In parallel, try to load with PDF.js to get page count
      pdfjsLib
        .getDocument({ data: pdfBytes })
        .promise.then((pdfDoc) => {
          pdfDocRef.current = pdfDoc
          setNumPages(pdfDoc.numPages)
          console.log('[PdfAcroFormViewer] PDF.js loaded successfully, pages:', pdfDoc.numPages)
        })
        .catch((pdfJsErr) => {
          console.warn('[PdfAcroFormViewer] PDF.js failed (non-critical, using iframe):', pdfJsErr)
        })

      // Extract form fields using pdf-lib (run in parallel, don't block rendering)
      extractFormFields(pdfBytes).catch((err) => {
        console.warn('[PdfAcroFormViewer] Form field extraction failed (non-critical):', err)
      })
    } catch (err: any) {
      console.error('[PdfAcroFormViewer] Error in loadPdf:', err)
      throw err // Re-throw so useEffect can handle it
    }
  }

  const renderPdfWithIframe = async (pdfBytes: Uint8Array) => {
    if (!containerRef.current) return

    // Clear container
    containerRef.current.innerHTML = ''

    // Create Blob from Uint8Array
    // Uint8Array is a valid BlobPart, but TypeScript may complain - cast if needed
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const iframe = document.createElement('iframe')
    iframe.src = `${url}#toolbar=1`
    iframe.style.width = '100%'
    iframe.style.height = '800px'
    iframe.style.border = '1px solid #e5e7eb'
    iframe.style.borderRadius = '8px'
    iframe.style.backgroundColor = '#fff'
    iframe.setAttribute('title', documentTitle || 'PDF Document')
    iframe.onload = () => {
      console.log('[PdfAcroFormViewer] PDF iframe loaded successfully')
    }
    iframe.onerror = (err) => {
      console.error('[PdfAcroFormViewer] PDF iframe load error:', err)
      setError('Failed to load PDF in iframe. The PDF file may be corrupted.')
    }

    // Store blob URL for cleanup
    ;(containerRef.current as any).__pdfBlobUrl = url

    containerRef.current.appendChild(iframe)
    console.log('[PdfAcroFormViewer] PDF iframe added to container, src:', url.substring(0, 50) + '...')

    // Try to extract form fields
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const form = pdfDoc.getForm()
      const fields = form.getFields()

      if (fields.length > 0) {
        await extractFormFields(pdfBytes)
      }
    } catch (err) {
      console.warn('Could not extract form fields:', err)
    }
  }

  const renderPdfWithDataUrl = async (base64Data: string) => {
    if (!containerRef.current) return

    console.log('[PdfAcroFormViewer] renderPdfWithDataUrl called')

    // Clear container
    containerRef.current.innerHTML = ''

    // Use data URL directly - this is the most reliable approach
    const dataUrl = `data:application/pdf;base64,${base64Data}`

    const iframe = document.createElement('iframe')
    iframe.src = `${dataUrl}#toolbar=1`
    iframe.style.width = '100%'
    iframe.style.height = '800px'
    iframe.style.border = '1px solid #e5e7eb'
    iframe.style.borderRadius = '8px'
    iframe.style.backgroundColor = '#fff'
    iframe.setAttribute('title', documentTitle || 'PDF Document')
    iframe.onload = () => {
      console.log('[PdfAcroFormViewer] PDF iframe loaded successfully (data URL)')
    }
    iframe.onerror = (err) => {
      console.error('[PdfAcroFormViewer] PDF iframe load error (data URL):', err)
      setError('Failed to load PDF. The PDF file may be corrupted or too large.')
    }

    containerRef.current.appendChild(iframe)
    console.log('[PdfAcroFormViewer] PDF iframe added with data URL, length:', base64Data.length)

    // Try to extract form fields
    try {
      const binaryString = atob(base64Data)
      const pdfBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i)
      }
      await extractFormFields(pdfBytes)
    } catch (err) {
      console.warn('[PdfAcroFormViewer] Could not extract form fields:', err)
    }
  }

  const renderPages = async (pdfDoc: pdfjsLib.PDFDocumentProxy) => {
    if (!containerRef.current) {
      console.error('Container ref not available for rendering')
      return
    }

    // Clear container
    containerRef.current.innerHTML = ''

    // Create pages container
    const pagesContainer = document.createElement('div')
    pagesContainer.className = 'space-y-4 flex flex-col items-center'

    try {
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.5 })

          // Create page container
          const pageDiv = document.createElement('div')
          pageDiv.className = 'pdf-page mb-4 border border-gray-300 bg-white shadow-sm rounded overflow-hidden'
          pageDiv.style.position = 'relative'
          pageDiv.style.width = `${viewport.width}px`
          pageDiv.style.height = `${viewport.height}px`
          pageDiv.style.margin = '0 auto'

          // Create canvas for PDF content
          const canvas = document.createElement('canvas')
          canvas.className = 'pdf-canvas'
          const context = canvas.getContext('2d')
          if (!context) {
            console.warn(`Could not get 2d context for page ${pageNum}`)
            continue
          }

          canvas.height = viewport.height
          canvas.width = viewport.width

          // Render PDF page to canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }

          await page.render(renderContext).promise
          pageDiv.appendChild(canvas)
          pagesContainer.appendChild(pageDiv)
        } catch (pageErr: any) {
          console.error(`Error rendering page ${pageNum}:`, pageErr)
          // Continue with other pages
        }
      }

      if (pagesContainer.children.length > 0) {
        containerRef.current.appendChild(pagesContainer)
        console.log(`[PdfAcroFormViewer] Successfully rendered ${pagesContainer.children.length} PDF pages`)
      } else {
        console.error('[PdfAcroFormViewer] No pages were rendered - throwing error')
        throw new Error('No pages were rendered')
      }
    } catch (renderErr: any) {
      console.error('Error in renderPages:', renderErr)
      throw renderErr
    }
  }

  const extractFormFields = async (pdfBytes: Uint8Array) => {
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const form = pdfDoc.getForm()
      const fields = form.getFields()

      const extractedFields: FormField[] = []

      for (const field of fields) {
        const name = field.getName()
        const type = field.constructor.name
        let fieldType: 'text' | 'checkbox' | 'dropdown' | 'textarea' = 'text'
        let value: any = ''
        let options: string[] | undefined

        try {
          if (type === 'PDFTextField') {
            fieldType = 'text'
            value = (field as any).getText() || ''
          } else if (type === 'PDFCheckBox') {
            fieldType = 'checkbox'
            value = (field as any).isChecked() || false
          } else if (type === 'PDFDropdown') {
            fieldType = 'dropdown'
            try {
              const optionsList = (field as any).getOptions()
              options = optionsList || []
              value = (field as any).getSelected() || ''
            } catch (e) {
              options = []
            }
          } else if (type === 'PDFRadioGroup') {
            fieldType = 'dropdown'
            try {
              const optionsList = (field as any).getOptions()
              options = optionsList || []
              value = (field as any).getSelected() || ''
            } catch (e) {
              options = []
            }
          }
        } catch (e) {
          console.warn(`Could not extract field ${name}:`, e)
          continue
        }

        extractedFields.push({
          name,
          type: fieldType,
          value,
          options,
        })
      }

      setFormFields(extractedFields)

      // Initialize field values state
      const initialValues: Record<string, any> = {}
      extractedFields.forEach((field) => {
        initialValues[field.name] = field.value
      })
      setFieldValues(initialValues)
    } catch (err) {
      console.error('Error extracting form fields:', err)
      // Continue even if field extraction fails - PDF will still be visible
    }
  }

  const updateFieldValue = (fieldName: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }))
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
      return false
    }

    setValidationErrors([])
    return true
  }

  const generateFilledPdf = async (): Promise<Blob> => {
    // Import the fill utility
    const { fillPdfWithValues } = await import('@/lib/pdf/fillPdfWithValues')

    // Get original PDF bytes
    const binaryString = atob(pdfData)
    const pdfBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      pdfBytes[i] = binaryString.charCodeAt(i)
    }

    // Generate filled PDF with captured field values
    const filledBlob = await fillPdfWithValues(pdfBytes, fieldValues)
    return filledBlob
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return

    try {
      setSaving(true)
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
    <div className="space-y-6">
      {/* PDF Viewer Container */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-700">
              {documentTitle || 'PDF Document'}
              {numPages > 0 && ` (${numPages} page${numPages > 1 ? 's' : ''})`}
            </p>
            {numPages === 0 && (
              <p className="text-xs text-gray-500 mt-1">Loading PDF...</p>
            )}
          </div>
          <div
            ref={containerRef}
            className="pdf-container overflow-auto max-h-[800px] border-2 border-gray-300 rounded-lg p-4 bg-white"
            style={{ minHeight: '500px', width: '100%' }}
          />
          {!loading && containerRef.current && containerRef.current.children.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ PDF viewer is empty. Check browser console for errors.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Fields Section */}
      {formFields.length > 0 && !readOnly && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Fill Out Form Fields</h3>
                <p className="text-sm text-gray-600">
                  Please fill out all the form fields below. These fields correspond to the PDF form above.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {field.name}
                      {requiredFields.includes(field.name) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    {field.type === 'text' && (
                      <Input
                        id={field.name}
                        value={fieldValues[field.name] || ''}
                        onChange={(e) => updateFieldValue(field.name, e.target.value)}
                        disabled={readOnly}
                        className={validationErrors.includes(field.name) ? 'border-red-500' : ''}
                      />
                    )}
                    {field.type === 'textarea' && (
                      <Textarea
                        id={field.name}
                        value={fieldValues[field.name] || ''}
                        onChange={(e) => updateFieldValue(field.name, e.target.value)}
                        disabled={readOnly}
                        className={validationErrors.includes(field.name) ? 'border-red-500' : ''}
                        rows={3}
                      />
                    )}
                    {field.type === 'checkbox' && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={field.name}
                          checked={fieldValues[field.name] || false}
                          onCheckedChange={(checked) => updateFieldValue(field.name, checked)}
                          disabled={readOnly}
                        />
                        <Label htmlFor={field.name} className="cursor-pointer font-normal">
                          {field.name}
                        </Label>
                      </div>
                    )}
                    {field.type === 'dropdown' && (
                      <Select
                        value={fieldValues[field.name]?.toString() || ''}
                        onValueChange={(value) => updateFieldValue(field.name, value)}
                        disabled={readOnly}
                      >
                        <SelectTrigger
                          className={validationErrors.includes(field.name) ? 'border-red-500' : ''}
                        >
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options && field.options.length > 0 ? (
                            field.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="">No options available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
