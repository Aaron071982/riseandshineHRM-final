import type { BillingEntry } from '@prisma/client'
import type { CycleBlocker } from './types'
import { isBlockingReviewFlag } from './scheduleClamp'

type SessionLike = {
  reviewFlag?: string | null
  clientName?: string
  dos?: Date | string
}

type EntryLike = Pick<
  BillingEntry,
  'id' | 'providerNameRaw' | 'matchStatus' | 'totalHours' | 'hourlyRate' | 'isExcluded'
> & {
  sessions?: SessionLike[]
}

export function getCycleBlockers(entries: EntryLike[]): CycleBlocker[] {
  const blockers: CycleBlocker[] = []

  for (const e of entries) {
    if (e.isExcluded) continue

    const flaggedSessions = (e.sessions ?? []).filter((s) => isBlockingReviewFlag(s.reviewFlag))
    if (flaggedSessions.length > 0) {
      const sample = flaggedSessions
        .slice(0, 2)
        .map((s) => s.reviewFlag)
        .join('; ')
      blockers.push({
        type: 'session_review',
        entryId: e.id,
        providerNameRaw: e.providerNameRaw,
        message: `${e.providerNameRaw}: ${flaggedSessions.length} session(s) need review (${sample}${flaggedSessions.length > 2 ? '…' : ''})`,
      })
    }

    if (e.totalHours <= 0) continue

    if (e.matchStatus === 'UNMATCHED') {
      blockers.push({
        type: 'unmatched',
        entryId: e.id,
        providerNameRaw: e.providerNameRaw,
        message: `${e.providerNameRaw} is unmatched (${e.totalHours.toFixed(2)} hrs)`,
      })
    } else if (e.matchStatus === 'NEEDS_REVIEW') {
      blockers.push({
        type: 'needs_review',
        entryId: e.id,
        providerNameRaw: e.providerNameRaw,
        message: `${e.providerNameRaw} needs match review (${e.totalHours.toFixed(2)} hrs)`,
      })
    } else if (
      (e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY') &&
      e.hourlyRate == null
    ) {
      blockers.push({
        type: 'missing_rate',
        entryId: e.id,
        providerNameRaw: e.providerNameRaw,
        message: `${e.providerNameRaw} has no pay rate set`,
      })
    }
  }

  return blockers
}

export function canFinalizeCycle(entries: EntryLike[]): boolean {
  return getCycleBlockers(entries).length === 0
}

/** Aggregate appointed-hours vs actual-stay summary (payroll entries only). */
export function getClampSummary(
  entries: {
    isExcluded: boolean
    sessions: {
      rawActualMinutes?: number | null
      actualMinutes: number
      clampApplied?: boolean | null
      reviewFlag?: string | null
    }[]
  }[]
): {
  /** Sessions where actual stay ≠ appointed (payable) hours */
  varianceCount: number
  underCount: number
  overCount: number
  /** Hours where actual < appointed */
  hoursUnder: number
  /** Hours where actual > appointed */
  hoursOver: number
  needsReviewCount: number
  /** @deprecated alias for underCount (UI compat) */
  reducedCount: number
  /** @deprecated alias for hoursUnder */
  hoursRemoved: number
} {
  let underCount = 0
  let overCount = 0
  let hoursUnder = 0
  let hoursOver = 0
  let needsReviewCount = 0

  for (const e of entries) {
    if (e.isExcluded) continue
    for (const s of e.sessions) {
      const raw = s.rawActualMinutes ?? s.actualMinutes
      const payable = s.actualMinutes
      const diff = raw - payable
      if (diff < -0.01) {
        underCount++
        hoursUnder += (payable - raw) / 60
      } else if (diff > 0.01) {
        overCount++
        hoursOver += diff / 60
      }
      if (isBlockingReviewFlag(s.reviewFlag)) needsReviewCount++
    }
  }

  return {
    varianceCount: underCount + overCount,
    underCount,
    overCount,
    hoursUnder,
    hoursOver,
    needsReviewCount,
    reducedCount: underCount,
    hoursRemoved: hoursUnder,
  }
}
