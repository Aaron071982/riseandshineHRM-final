import {
  PDFBool,
  PDFCheckBox,
  PDFDocument,
  PDFName,
  PDFTextField,
  StandardFonts,
  type PDFForm,
} from 'pdf-lib'
import {
  LS54_REQUIRED_TEXT_FIELDS,
  buildLs54FieldValues,
  type Ls54FillInput,
} from '@/lib/onboarding/ls54'

function applyFieldValues(
  form: PDFForm,
  fieldValues: Record<string, string | boolean>
): { applied: string[]; missing: string[] } {
  const fieldMap = new Map(form.getFields().map((f) => [f.getName(), f]))
  const applied: string[] = []
  const missing: string[] = []

  for (const [fieldName, value] of Object.entries(fieldValues)) {
    if (value === undefined || value === null || value === '') continue
    const field = fieldMap.get(fieldName)
    if (!field) {
      missing.push(fieldName)
      continue
    }
    try {
      // Use instanceof — constructor.name breaks under Next.js production minify.
      if (field instanceof PDFTextField) {
        field.setText(String(value))
        applied.push(fieldName)
      } else if (field instanceof PDFCheckBox) {
        if (value === true || value === 'true' || value === '1') field.check()
        else field.uncheck()
        applied.push(fieldName)
      } else {
        missing.push(fieldName)
      }
    } catch (err) {
      console.error(`[ls54-pdf] failed to set ${fieldName}`, err)
      missing.push(fieldName)
    }
  }

  return { applied, missing }
}

function assertRequiredFieldsFilled(form: PDFForm): void {
  const empty: string[] = []
  for (const name of LS54_REQUIRED_TEXT_FIELDS) {
    try {
      const text = form.getTextField(name).getText()?.trim() ?? ''
      if (!text) empty.push(name)
    } catch {
      empty.push(name)
    }
  }
  if (empty.length > 0) {
    throw new Error(
      `LS-54 fill left required fields blank: ${empty.join(', ')}. Check the PDF template field names.`
    )
  }
}

/**
 * Fill LS-54 template and return PDF bytes with visible values.
 *
 * This government AcroForm's flatten() throws (broken page refs). We rely on
 * updateFieldAppearances + NeedAppearances so each value renders once. Do NOT
 * also burn text onto the page — that doubles every filled field in Preview/Chrome.
 */
export async function fillLs54Pdf(
  pdfBytes: Uint8Array,
  input: Ls54FillInput
): Promise<Buffer> {
  const fieldValues = buildLs54FieldValues(input)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()

  const { applied, missing } = applyFieldValues(form, fieldValues)
  if (applied.length === 0) {
    throw new Error(
      `LS-54 fill applied 0 fields (missing: ${missing.join(', ') || 'unknown'}). Template may be wrong.`
    )
  }

  assertRequiredFieldsFilled(form)

  try {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    form.updateFieldAppearances(font)
  } catch (err) {
    console.warn('[ls54-pdf] updateFieldAppearances failed', err)
  }

  try {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)
  } catch {
    /* optional */
  }

  try {
    form.flatten()
  } catch (err) {
    console.warn('[ls54-pdf] flatten skipped (expected for LS-54):', (err as Error).message)
  }

  const saved = await pdfDoc.save({ updateFieldAppearances: false })
  return Buffer.from(saved)
}
