import type { BillingMatchStatus } from '@prisma/client'

export type ParsedSessionRow = {
  providerName: string
  clientName: string
  dos: Date
  scheduledMinutes: number
  actualMinutes: number
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
  type: 'unmatched' | 'needs_review' | 'missing_rate'
  entryId: string
  providerNameRaw: string
  message: string
}
