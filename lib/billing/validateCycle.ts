import type { BillingEntry } from '@prisma/client'
import type { CycleBlocker } from './types'

type EntryLike = Pick<
  BillingEntry,
  'id' | 'providerNameRaw' | 'matchStatus' | 'totalHours' | 'hourlyRate' | 'isExcluded'
>

export function getCycleBlockers(entries: EntryLike[]): CycleBlocker[] {
  const blockers: CycleBlocker[] = []

  for (const e of entries) {
    if (e.isExcluded) continue
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
