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
      // Cleanup
      if (container) {
        // Cleanup if needed
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

      // Decode base64 PDF
      const binaryString = atob(pdfData)
      const pdfBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i)
      }

      // Load PDF document with PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
      const pdfDoc = await loadingTask.promise
      pdfDocRef.current = pdfDoc
      setNumPages(pdfDoc.numPages)

      // Render PDF pages
      await renderPages(pdfDoc)

      // Extract form fields using pdf-lib
      await extractFormFields(pdfBytes)

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

    // Create pages container
    const pagesContainer = document.createElement('div')
    pagesContainer.className = 'space-y-4'

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })

      // Create page container
      const pageDiv = document.createElement('div')
      pageDiv.className = 'pdf-page mb-4 border border-gray-300 bg-white shadow-sm rounded'
      pageDiv.style.position = 'relative'
      pageDiv.style.width = `${viewport.width}px`
      pageDiv.style.height = `${viewport.height}px`
      pageDiv.style.margin = '0 auto'

      // Create canvas for PDF content
      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-canvas'
      const context = canvas.getContext('2d')
      if (!context) continue

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
    }

    containerRef.current.appendChild(pagesContainer)
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
          <div
            ref={containerRef}
            className="pdf-container overflow-auto max-h-[800px] border border-gray-200 rounded-lg p-4 bg-gray-50"
            style={{ minHeight: '400px' }}
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
