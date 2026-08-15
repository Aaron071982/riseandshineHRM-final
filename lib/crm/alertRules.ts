import type { AlertSeverity, ClientStage } from '@prisma/client'
import { AUTH_EXPIRY_BANDS, type AuthExpiryBand } from '@/lib/crm/thresholds'

/** Map days-left into the tightest AUTH_EXPIRY_BANDS entry. */
export function authBandForDaysLeft(daysLeft: number): AuthExpiryBand | null {
  if (daysLeft < 0) return AUTH_EXPIRY_BANDS[AUTH_EXPIRY_BANDS.length - 1]
  for (const band of [...AUTH_EXPIRY_BANDS].sort((a, b) => a - b)) {
    if (daysLeft <= band) return band
  }
  return null
}

/** INFO (60) → WARNING (30/15) → URGENT (7). */
export function authSeverityForBand(band: AuthExpiryBand): AlertSeverity {
  if (band <= 7) return 'URGENT'
  if (band <= 30) return 'WARNING'
  return 'INFO'
}

export function stalledSeverity(
  days: number,
  maxDays: number
): AlertSeverity {
  if (days > maxDays * 2) return 'URGENT'
  return 'WARNING'
}

/** Stage → journey email template (on entering that stage). */
export const STAGE_JOURNEY_TEMPLATE: Partial<
  Record<
    ClientStage,
    | 'INQUIRY_ACK'
    | 'CONSENT_REQUEST'
    | 'DOCS_NEEDED'
    | 'BENEFITS_UPDATE'
    | 'ASSESSMENT_SCHEDULED'
    | 'AUTH_APPROVED'
    | 'READY_FOR_STAFFING'
    | 'RBT_ASSIGNED'
    | 'SCHEDULE_CONFIRMED'
    | 'SERVICES_STARTED'
  >
> = {
  INQUIRY: 'INQUIRY_ACK',
  CONSENT: 'CONSENT_REQUEST',
  DOCUMENTS: 'DOCS_NEEDED',
  BENEFITS: 'BENEFITS_UPDATE',
  ASSESSMENT: 'ASSESSMENT_SCHEDULED',
  APPROVED: 'AUTH_APPROVED',
  READY_FOR_STAFFING: 'READY_FOR_STAFFING',
  RBT_ASSIGNED: 'RBT_ASSIGNED',
  SCHEDULE_CONFIRMED: 'SCHEDULE_CONFIRMED',
  ACTIVE: 'SERVICES_STARTED',
}
