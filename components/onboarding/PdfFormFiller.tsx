'use client'

import { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'

export function usePdfFormFiller(pdfDataBase64: string) {
  const [formFields, setFormFields] = useState<Array<{ name: string; type: string; value: any }>>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPdf() {
      if (!pdfDataBase64 || pdfDataBase64.length === 0) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        const binaryString = atob(pdfDataBase64)
        const pdfBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          pdfBytes[i] = binaryString.charCodeAt(i)
        }

        const doc = await PDFDocument.load(pdfBytes)
        
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
        setFormFields([])
      } finally {
        setLoading(false)
      }
    }

    loadPdf()
  }, [pdfDataBase64])

  const updateField = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const getFilledPdf = async (originalPdfBase64: string): Promise<string> => {
    if (!originalPdfBase64 || originalPdfBase64.length === 0) {
      throw new Error('PDF data not available')
    }

    try {
      // Decode and load PDF fresh
      const binaryString = atob(originalPdfBase64)
      const pdfBytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i)
      }

      const doc = await PDFDocument.load(pdfBytes)
      const form = doc.getForm()
      const fields = form.getFields()

      // Fill form fields with our form data
      let filledCount = 0
      for (const field of fields) {
        try {
          const name = field.getName()
          const value = formData[name]
          const type = field.constructor.name

          if (value !== undefined && value !== null && value !== '') {
            if (type === 'PDFTextField') {
              ;(field as any).setText(String(value))
              filledCount++
            } else if (type === 'PDFCheckBox' && value === true) {
              ;(field as any).check()
              filledCount++
            } else if ((type === 'PDFDropdown' || type === 'PDFRadioGroup') && value) {
              try {
                ;(field as any).select(String(value))
                filledCount++
              } catch (e) {
                // Value might not be valid option, skip
                console.log(`Could not select value "${value}" for field ${name}`)
              }
            }
          }
        } catch (error) {
          console.error(`Error filling field ${field.getName()}:`, error)
        }
      }

      console.log(`Filled ${filledCount} form fields with data`)

      // Flatten form to make it non-editable
      try {
        form.flatten()
      } catch (e) {
        // Some forms might not be flattenable
        console.log('Could not flatten form (may already be flat)')
      }

      // Save PDF
      const filledPdfBytes = await doc.save()
      const result = btoa(String.fromCharCode(...filledPdfBytes))
      return result
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
