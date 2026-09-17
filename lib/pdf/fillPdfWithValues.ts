import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from 'pdf-lib'

/**
 * Fills a PDF form with field values and returns a filled PDF as a Blob
 * @param pdfBytes Original PDF bytes
 * @param fieldValues Record mapping field names to their values
 * @returns Filled PDF as a Blob
 */
export async function fillPdfWithValues(
  pdfBytes: Uint8Array,
  fieldValues: Record<string, any>,
  options?: { flatten?: boolean; updateAppearances?: boolean }
): Promise<Blob> {
  try {
    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes)

    // Get the form
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    // Create a map of field names to field objects for easier lookup
    const fieldMap = new Map<string, (typeof fields)[number]>()
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
          continue
        }

        // instanceof survives Next.js production minify; constructor.name does not.
        if (field instanceof PDFTextField) {
          field.setText(String(value))
        } else if (field instanceof PDFCheckBox) {
          if (value === true || value === 'true' || value === '1') {
            field.check()
          } else {
            field.uncheck()
          }
        } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup) {
          try {
            field.select(String(value))
          } catch {
            // Value might not be a valid option
          }
        }
      } catch (fieldError) {
        console.error(`Error filling field "${fieldName}":`, fieldError)
        // Continue with other fields
      }
    }

    if (options?.flatten) {
      try {
        form.flatten()
      } catch {
        // Some government PDFs fail flatten — save without it
      }
    } else if (options?.updateAppearances !== false) {
      try {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        form.updateFieldAppearances(font)
      } catch (appearanceErr) {
        console.warn('[fillPdfWithValues] updateFieldAppearances failed:', appearanceErr)
      }
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
