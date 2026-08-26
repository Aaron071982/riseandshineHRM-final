import type { AuthExpiryBand } from '@/lib/crm/thresholds'
import { AUTH_EXPIRY_BANDS } from '@/lib/crm/thresholds'

export type AuthBandLabel = AuthExpiryBand | 'expired' | 'beyond'

/** Days remaining until end-of-day expiration (negative = expired). */
export function daysUntilExpiry(expirationDate: Date, now = new Date()): number {
  const end = new Date(expirationDate)
  end.setHours(23, 59, 59, 999)
  const ms = end.getTime() - now.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/**
 * Map days-remaining into the 45/30/14/7/0 band engine (or expired / beyond).
 * A row with 20 days remaining is in the 30-day band (attention within 30 days).
 */
export function authExpiryBand(daysRemaining: number): AuthBandLabel {
  if (daysRemaining < 0) return 'expired'
  for (let i = AUTH_EXPIRY_BANDS.length - 1; i >= 0; i--) {
    const band = AUTH_EXPIRY_BANDS[i]!
    if (daysRemaining <= band) return band
  }
  return 'beyond'
}

export function authBandLabel(band: AuthBandLabel): string {
  if (band === 'expired') return 'Expired'
  if (band === 'beyond') return '>45 days'
  if (band === 0) return 'Due today / overdue'
  return `≤${band} days`
}

/** True when expiration falls inside the attention window (≤45 days or expired). */
export function isInAuthAttentionWindow(daysRemaining: number): boolean {
  return daysRemaining <= 45
}
