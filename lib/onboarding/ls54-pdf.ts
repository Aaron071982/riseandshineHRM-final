import {
  PDFCheckBox,
  PDFDocument,
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
 * Burn text into the page at each text-field widget so Preview/Chrome show
 * values even when this government AcroForm refuses to flatten.
 * LS-54 is a single-page form — always draw on page 0.
 *
 * After drawing, callers must remove (or empty) the text fields — otherwise
 * viewers show both the burned page ink and the AcroForm appearance (doubled).
 */
async function burnTextFieldsOntoPages(pdfDoc: PDFDocument, form: PDFForm): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const page = pdfDoc.getPages()[0]
  if (!page) return

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue
    const text = field.getText()?.trim()
    if (!text) continue

    for (const widget of field.acroField.getWidgets()) {
      const rect = widget.getRectangle()
      const fontSize = Math.min(10, Math.max(7, rect.height * 0.7))
      page.drawText(text, {
        x: rect.x + 2,
        y: rect.y + Math.max(2, (rect.height - fontSize) / 2),
        size: fontSize,
        font,
        maxWidth: Math.max(8, rect.width - 4),
        lineHeight: fontSize + 1,
      })
    }
  }
}

/** Drop text fields after burn-in so AcroForm appearances cannot double the ink. */
function removeTextFieldsAfterBurn(form: PDFForm): void {
  for (const field of [...form.getFields()]) {
    if (!(field instanceof PDFTextField)) continue
    try {
      form.removeField(field)
    } catch (err) {
      try {
        field.setText('')
      } catch {
        console.warn(
          '[ls54-pdf] could not remove text field after burn',
          field.getName(),
          err
        )
      }
    }
  }
}

function markCheckedBoxesVisually(pdfDoc: PDFDocument, form: PDFForm): void {
  const page = pdfDoc.getPages()[0]
  if (!page) return

  for (const field of form.getFields()) {
    if (!(field instanceof PDFCheckBox)) continue
    try {
      if (!field.isChecked()) continue
      for (const widget of field.acroField.getWidgets()) {
        const rect = widget.getRectangle()
        const inset = 2
        page.drawLine({
          start: { x: rect.x + inset, y: rect.y + inset },
          end: {
            x: rect.x + rect.width - inset,
            y: rect.y + rect.height - inset,
          },
          thickness: 1.25,
        })
        page.drawLine({
          start: { x: rect.x + inset, y: rect.y + rect.height - inset },
          end: { x: rect.x + rect.width - inset, y: rect.y + inset },
          thickness: 1.25,
        })
      }
    } catch {
      /* skip */
    }
  }
}

/** Fill LS-54 template and return PDF bytes with visible values (burned in). */
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

  // Do not call updateFieldAppearances / NeedAppearances — that embeds a second
  // copy of each value in the widget appearance stream. Burn page ink only.
  await burnTextFieldsOntoPages(pdfDoc, form)
  markCheckedBoxesVisually(pdfDoc, form)
  removeTextFieldsAfterBurn(form)

  try {
    form.flatten()
  } catch (err) {
    console.warn('[ls54-pdf] flatten skipped (expected for LS-54):', (err as Error).message)
  }

  const saved = await pdfDoc.save()
  return Buffer.from(saved)
}
