/**
 * Mode A seam — structured assessment entry + rendered template + graphs.
 * Not implemented in Phase E (upload + lock only).
 */

export type StructuredAssessmentField = {
  key: string
  label: string
  value: string | number | boolean | null
}

export type StructuredAssessmentPayload = {
  fields: StructuredAssessmentField[]
  /** Reserved for future graph series attachment. */
  graphSeries?: Record<string, number[]>
}

export type StructuredAssessmentRenderResult = {
  pdfBytes: Buffer
  parserVersion: string
}

/** Stub — attach structured renderer here in a future phase. */
export function renderStructuredClinicalAssessment(
  _payload: StructuredAssessmentPayload
): StructuredAssessmentRenderResult {
  throw new Error('Structured clinical assessment (Mode A) is not implemented')
}

export function isStructuredAssessmentEnabled(): boolean {
  return false
}
