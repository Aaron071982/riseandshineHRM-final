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

/** Aggregate clamp summary across cycle sessions (payroll entries only). */
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
  reducedCount: number
  hoursRemoved: number
  needsReviewCount: number
} {
  let reducedCount = 0
  let hoursRemoved = 0
  let needsReviewCount = 0

  for (const e of entries) {
    if (e.isExcluded) continue
    for (const s of e.sessions) {
      const raw = s.rawActualMinutes ?? s.actualMinutes
      const payable = s.actualMinutes
      if (raw - payable > 0.01) {
        reducedCount++
        hoursRemoved += (raw - payable) / 60
      }
      if (isBlockingReviewFlag(s.reviewFlag)) needsReviewCount++
    }
  }

  return { reducedCount, hoursRemoved, needsReviewCount }
}
