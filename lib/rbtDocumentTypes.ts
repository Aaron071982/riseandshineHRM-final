/** Stored on `RBTDocument.documentType` (string). */
export const ADMIN_RBT_DOCUMENT_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'OTHER', label: 'Other' },
  { value: 'RESUME', label: 'Resume' },
  { value: 'SOCIAL_SECURITY_CARD', label: 'Social Security card' },
  { value: 'FORTY_HOUR_CERTIFICATE', label: '40-hour RBT certificate' },
  { value: 'RBT_CERTIFICATE', label: 'RBT certificate' },
  { value: 'CPR_CARD', label: 'CPR / First aid card' },
  { value: 'GOVERNMENT_ID', label: 'Government ID' },
  { value: 'CONTRACT', label: 'Contract / offer' },
  { value: 'W4', label: 'W-4 / tax form' },
]

export function formatRbtDocumentTypeLabel(code: string | null | undefined): string {
  if (!code) return 'Other'
  const found = ADMIN_RBT_DOCUMENT_TYPES.find((t) => t.value === code)
  if (found) return found.label
  return code.replace(/_/g, ' ')
}
