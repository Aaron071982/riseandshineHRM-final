import { PDFDocument } from 'pdf-lib'

/**
 * Fills a PDF form with field values and returns a filled PDF as a Blob
 * @param pdfBytes Original PDF bytes
 * @param fieldValues Record mapping field names to their values
 * @returns Filled PDF as a Blob
 */
export async function fillPdfWithValues(
  pdfBytes: Uint8Array,
  fieldValues: Record<string, any>
): Promise<Blob> {
  try {
    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes)

    // Get the form
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    // Create a map of field names to field objects for easier lookup
    const fieldMap = new Map<string, any>()
    fields.forEach((field) => {
      const name = field.getName()
      fieldMap.set(name, field)
    })

    // Fill each field with its value
    for (const [fieldName, value] of Object.entries(fieldValues)) {
      if (value === undefined || value === null || value === '') {
        continue // Skip empty values
      }

      try {
        const field = fieldMap.get(fieldName)
        if (!field) {
          console.warn(`Field "${fieldName}" not found in PDF`)
          continue
        }

        const fieldType = field.constructor.name

        switch (fieldType) {
          case 'PDFTextField':
            // Text field
            field.setText(String(value))
            break

          case 'PDFCheckBox':
            // Checkbox - value should be boolean or truthy/falsy
            if (value === true || value === 'true' || value === '1') {
              field.check()
            } else {
              field.uncheck()
            }
            break

          case 'PDFDropdown':
          case 'PDFRadioGroup':
            // Dropdown or radio button - select the value
            try {
              field.select(String(value))
            } catch (selectError) {
              // Value might not be a valid option, try to find similar
              console.warn(`Could not select "${value}" for field "${fieldName}"`, selectError)
            }
            break

          default:
            console.warn(`Unknown field type "${fieldType}" for field "${fieldName}"`)
        }
      } catch (fieldError) {
        console.error(`Error filling field "${fieldName}":`, fieldError)
        // Continue with other fields
      }
    }

    // Flatten the form to make fields permanent (non-editable)
    try {
      form.flatten()
    } catch (flattenError) {
      // Some forms might not be flattenable, that's okay
      console.warn('Could not flatten form (may already be flat or have restrictions):', flattenError)
    }

    // Generate PDF bytes (returns Uint8Array)
    const filledPdfBytes = await pdfDoc.save()

    // Convert Uint8Array to Blob
    // Uint8Array is a valid BlobPart, but TypeScript may need explicit typing
    const blob = new Blob([filledPdfBytes as BlobPart], { type: 'application/pdf' })
    return blob
  } catch (error) {
    console.error('Error filling PDF with values:', error)
    throw new Error(`Failed to fill PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

