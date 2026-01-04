'use client'

import { useState, useEffect, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'

interface PdfFormFillerProps {
  pdfData: string // base64 encoded PDF
  onFormDataChange?: (formData: Record<string, any>) => void
  onPdfReady?: (filledPdfBase64: string) => void
}

export function usePdfFormFiller(pdfData: string) {
  const [formFields, setFormFields] = useState<Array<{ name: string; type: string; value: any }>>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPdf() {
      try {
        setLoading(true)
        const binaryString = atob(pdfData)
        const pdfBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          pdfBytes[i] = binaryString.charCodeAt(i)
        }

        const doc = await PDFDocument.load(pdfBytes)
        setPdfDoc(doc)
        
        const form = doc.getForm()
        const fields = form.getFields()
        const fieldsList = fields.map((field) => {
          const name = field.getName()
          const type = field.constructor.name
          let value: any = ''
          
          try {
            if (type === 'PDFTextField') {
              value = (field as any).getText() || ''
            } else if (type === 'PDFCheckBox') {
              value = (field as any).isChecked() || false
            } else if (type === 'PDFDropdown' || type === 'PDFRadioGroup') {
              value = (field as any).getSelected() || ''
            }
          } catch (e) {
            // Field might not be accessible
          }
          
          return { name, type, value }
        })
        
        setFormFields(fieldsList)
        const initialData: Record<string, any> = {}
        fieldsList.forEach((f) => {
          initialData[f.name] = f.value
        })
        setFormData(initialData)
      } catch (error) {
        console.error('Error loading PDF:', error)
      } finally {
        setLoading(false)
      }
    }

    if (pdfData) {
      loadPdf()
    }
  }, [pdfData])

  const updateField = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const getFilledPdf = async (): Promise<string> => {
    if (!pdfDoc) {
      throw new Error('PDF not loaded')
    }

    try {
      const form = pdfDoc.getForm()
      const fields = form.getFields()

      // Fill form fields with our form data
      fields.forEach((field) => {
        try {
          const name = field.getName()
          const value = formData[name]
          const type = field.constructor.name

          if (value !== undefined && value !== null && value !== '') {
            if (type === 'PDFTextField') {
              ;(field as any).setText(String(value))
            } else if (type === 'PDFCheckBox') {
              ;(field as any).check()
            } else if (type === 'PDFDropdown' || type === 'PDFRadioGroup') {
              ;(field as any).select(value)
            }
          }
        } catch (error) {
          console.error(`Error filling field ${field.getName()}:`, error)
        }
      })

      // Flatten form to make it non-editable
      form.flatten()

      // Save PDF
      const pdfBytes = await pdfDoc.save()
      return btoa(String.fromCharCode(...pdfBytes))
    } catch (error) {
      console.error('Error generating filled PDF:', error)
      throw error
    }
  }

  return {
    formFields,
    formData,
    updateField,
    getFilledPdf,
    loading,
  }
}

