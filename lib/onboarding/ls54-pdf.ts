import { fillPdfWithValues } from '@/lib/pdf/fillPdfWithValues'
import { buildLs54FieldValues, type Ls54FillInput } from '@/lib/onboarding/ls54'

/** Fill LS-54 template and return PDF bytes with visible field appearances. */
export async function fillLs54Pdf(
  pdfBytes: Uint8Array,
  input: Ls54FillInput
): Promise<Buffer> {
  const fieldValues = buildLs54FieldValues(input)
  const blob = await fillPdfWithValues(pdfBytes, fieldValues, {
    flatten: false,
    updateAppearances: true,
  })
  return Buffer.from(await blob.arrayBuffer())
}
