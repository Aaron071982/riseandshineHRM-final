import type { BillingMatchStatus } from '@prisma/client'

export type ParsedSessionRow = {
  providerName: string
  clientName: string
  dos: Date
  scheduledMinutes: number
  /** Payable minutes = appointed hours (or raw fallback if appointment times missing). */
  actualMinutes: number
  /** Raw Artemis "Actual Duration" minutes (stay log; display only). */
  rawActualMinutes: number
  clampedPayableMinutes: number
  clampApplied: boolean
  reviewFlag: string | null
  scheduledStart: Date | null
  scheduledEnd: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  procedureCode: string | null
  location: string | null
  role: string
  rawStatus: string | null
  sessionStatus: string | null
}

export type ProviderGroup = {
  providerName: string
  role: string
  sessions: ParsedSessionRow[]
  totalSessions: number
  totalMinutes: number
  totalHours: number
}

export type ArtemisParseResult = {
  payrollGroups: ProviderGroup[]
  excludedGroups: ProviderGroup[]
  stats: {
    totalRows: number
    payrollSessionCount: number
    excludedSessionCount: number
    cancelledSessionCount: number
    skippedSessionCount: number
    payrollProviderCount: number
    excludedProviderCount: number
    byRole: Record<string, number>
    /** Total hours per normalized status (includes cancelled/deleted for verification). */
    hoursByStatus: Record<string, number>
    /** Appointed-hours vs actual-stay summary from parse. */
    clamp?: {
      sessionsWithAllTimes: number
      sessionsHoursChanged: number
      sessionsDateMismatch: number
      sessionsNoOverlap: number
      sessionsMissingTimes: number
      /** Hours where actual stay < appointed (informational). */
      hoursRemovedByClamp: number
      /** Hours where actual stay > appointed (informational). */
      hoursOverAppointed: number
    }
  }
  detectedDateRange: { min: Date | null; max: Date | null }
}

export type RbtMatchCandidate = {
  id: string
  firstName: string
  lastName: string
  artemisProviderName: string | null
  hourlyPayRate: number | null
}

export type MatchResult = {
  matchStatus: BillingMatchStatus
  matchConfidence: number
  rbtProfileId: string | null
  suggestedRbtProfileId: string | null
  hourlyRate: number | null
  suggestedHourlyRate: number | null
}

export type CycleBlocker = {
  type: 'unmatched' | 'needs_review' | 'missing_rate' | 'session_review'
  entryId: string
  providerNameRaw: string
  message: string
}
