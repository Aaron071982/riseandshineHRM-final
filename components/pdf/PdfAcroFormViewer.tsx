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
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

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
      // Cleanup blob URLs
      if (container) {
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
        console.error('Container ref not available')
        setError('PDF viewer container not available')
        setLoading(false)
        return
      }

      if (!pdfData || pdfData.length === 0) {
        console.error('PDF data is empty')
        setError('PDF data not available')
        setLoading(false)
        return
      }

      console.log('Loading PDF, data length:', pdfData.length)

      // Decode base64 PDF
      let binaryString: string
      let pdfBytes: Uint8Array
      try {
        binaryString = atob(pdfData)
        pdfBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          pdfBytes[i] = binaryString.charCodeAt(i)
        }
        console.log('PDF bytes decoded, length:', pdfBytes.length)
      } catch (decodeErr: any) {
        console.error('Error decoding PDF data:', decodeErr)
        setError('Failed to decode PDF data: ' + decodeErr.message)
        setLoading(false)
        return
      }

      // Try PDF.js first, fallback to iframe if it fails
      try {
        // Load PDF document with PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
        const pdfDoc = await loadingTask.promise
        pdfDocRef.current = pdfDoc
        setNumPages(pdfDoc.numPages)
        console.log('PDF loaded with PDF.js, pages:', pdfDoc.numPages)

        // Render PDF pages
        await renderPages(pdfDoc)

        // Extract form fields using pdf-lib (run in parallel, don't block rendering)
        extractFormFields(pdfBytes).catch((err) => {
          console.warn('Form field extraction failed (non-critical):', err)
        })
      } catch (pdfJsErr: any) {
        console.warn('PDF.js failed, using iframe fallback:', pdfJsErr)
        // Fallback to iframe - ensures PDF is always visible
        await renderPdfWithIframe(pdfBytes)
        // Still try to extract form fields
        extractFormFields(pdfBytes).catch((err) => {
          console.warn('Form field extraction failed (non-critical):', err)
        })
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Error loading PDF:', err)
      setError(err.message || 'Failed to load PDF')
      setLoading(false)
    }
  }

  const renderPdfWithIframe = async (pdfBytes: Uint8Array) => {
    if (!containerRef.current) return

    // Clear container
    containerRef.current.innerHTML = ''

    // Create Blob from Uint8Array
    // Use Array.from to convert Uint8Array to regular array for Blob
    const blob = new Blob([Array.from(pdfBytes)], { type: 'application/pdf' })
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
      console.log('PDF iframe loaded successfully')
    }
    iframe.onerror = (err) => {
      console.error('PDF iframe load error:', err)
    }

    // Store blob URL for cleanup
    ;(containerRef.current as any).__pdfBlobUrl = url

    containerRef.current.appendChild(iframe)
    console.log('PDF iframe added to container')

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
        console.log(`Successfully rendered ${pagesContainer.children.length} PDF pages`)
      } else {
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
          <div className="mb-2">
            <p className="text-sm text-gray-600 font-medium">
              {documentTitle || 'PDF Document'}
              {numPages > 0 && ` (${numPages} page${numPages > 1 ? 's' : ''})`}
            </p>
          </div>
          <div
            ref={containerRef}
            className="pdf-container overflow-auto max-h-[800px] border border-gray-200 rounded-lg p-4 bg-gray-50"
            style={{ minHeight: '400px', width: '100%' }}
          />
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
