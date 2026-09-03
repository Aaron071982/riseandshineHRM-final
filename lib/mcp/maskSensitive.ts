/**
 * Mask raw identity / financial account numbers in MCP super-admin outputs.
 * Pay amounts, hours, and rates are left intact — only SSN / gov ID / bank / card digits.
 */

const SSN_RE = /\b(\d{3})[-\s]?(\d{2})[-\s]?(\d{4})\b/g
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g
const BANK_ROUTING_RE = /\b(\d{9})\b/g
const ACCOUNT_LIKE_RE = /\b(?:acct|account|routing|aba|iban)[:\s#-]*([0-9]{6,17})\b/gi
const DL_RE = /\b(?:DL|license|passport|gov(?:ernment)?\s*id)[:\s#-]*([A-Z0-9]{6,20})\b/gi

function last4Digits(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `****${digits.slice(-4)}`
}

export function maskSensitiveIdentifiers(input: string): string {
  let out = input
  out = out.replace(SSN_RE, (_m, _a, _b, last4: string) => `***-**-${last4}`)
  out = out.replace(ACCOUNT_LIKE_RE, (m, digits: string) =>
    m.replace(digits, last4Digits(digits))
  )
  out = out.replace(DL_RE, (m, id: string) => m.replace(id, `****${id.slice(-4)}`))
  out = out.replace(CARD_RE, (m) => {
    const digits = m.replace(/\D/g, '')
    // Avoid mangling ordinary phone-ish or short numbers; cards are 13–19 digits
    if (digits.length < 13 || digits.length > 19) return m
    return last4Digits(digits)
  })
  // Standalone 9-digit routing only when labeled nearby — handled by ACCOUNT_LIKE_RE.
  void BANK_ROUTING_RE
  return out
}

export function maskSensitiveDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return maskSensitiveIdentifiers(value) as T
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskSensitiveDeep(v)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase()
      if (
        key.includes('ssn') ||
        key.includes('socialsecurity') ||
        key.includes('bankaccount') ||
        key.includes('routing') ||
        key.includes('cardnumber') ||
        key.includes('accountnumber')
      ) {
        if (typeof v === 'string' || typeof v === 'number') {
          out[k] = last4Digits(String(v))
          continue
        }
      }
      out[k] = maskSensitiveDeep(v)
    }
    return out as T
  }
  return value
}
