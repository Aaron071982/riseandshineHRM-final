/** Payee tax classification for stub generation and PDF framing. */
export type PayeeClassification = '1099' | 'W2'

export function normalizePayeeClassification(
  value: string | null | undefined
): PayeeClassification {
  const v = (value ?? '').trim().toUpperCase()
  if (v === 'W2' || v === 'W-2') return 'W2'
  return '1099'
}

export function isW2Classification(
  value: string | null | undefined
): boolean {
  return normalizePayeeClassification(value) === 'W2'
}
