import { distance } from 'fastest-levenshtein'
import type { BillingMatchStatus } from '@prisma/client'
import type { MatchResult, RbtMatchCandidate } from './types'

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function fullName(p: RbtMatchCandidate): string {
  return `${p.firstName} ${p.lastName}`.trim()
}

function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - distance(na, nb) / maxLen
}

export function matchProviderToRbt(
  providerName: string,
  candidates: RbtMatchCandidate[],
  suggestedRates: Map<string, number | null>
): MatchResult {
  const remembered = candidates.find((c) => c.artemisProviderName === providerName)
  if (remembered) {
    const rate = remembered.hourlyPayRate
    const suggested = suggestedRates.get(remembered.id) ?? null
    return {
      matchStatus: 'MATCHED',
      matchConfidence: 1,
      rbtProfileId: remembered.id,
      suggestedRbtProfileId: null,
      hourlyRate: rate,
      suggestedHourlyRate: rate == null ? suggested : null,
    }
  }

  const exact = candidates.find((c) => normalizeName(fullName(c)) === normalizeName(providerName))
  if (exact) {
    const rate = exact.hourlyPayRate
    const suggested = suggestedRates.get(exact.id) ?? null
    return {
      matchStatus: 'MATCHED',
      matchConfidence: 1,
      rbtProfileId: exact.id,
      suggestedRbtProfileId: null,
      hourlyRate: rate,
      suggestedHourlyRate: rate == null ? suggested : null,
    }
  }

  let best: { candidate: RbtMatchCandidate; score: number } | null = null
  for (const c of candidates) {
    const score = similarity(providerName, fullName(c))
    if (!best || score > best.score) {
      best = { candidate: c, score }
    }
  }

  if (!best || best.score < 0.6) {
    return {
      matchStatus: 'UNMATCHED',
      matchConfidence: best?.score ?? 0,
      rbtProfileId: null,
      suggestedRbtProfileId: best && best.score >= 0.4 ? best.candidate.id : null,
      hourlyRate: null,
      suggestedHourlyRate: null,
    }
  }

  const { candidate, score } = best
  const rate = candidate.hourlyPayRate
  const suggested = suggestedRates.get(candidate.id) ?? null
  const status: BillingMatchStatus = score > 0.85 ? 'MATCHED' : 'NEEDS_REVIEW'

  return {
    matchStatus: status,
    matchConfidence: score,
    rbtProfileId: status === 'MATCHED' ? candidate.id : null,
    suggestedRbtProfileId: candidate.id,
    hourlyRate: status === 'MATCHED' ? rate : null,
    suggestedHourlyRate: rate == null ? suggested : null,
  }
}

export function computeEntryPay(totalHours: number, hourlyRate: number | null, adjustment = 0): {
  grossPay: number
  finalPay: number
} {
  const grossPay = hourlyRate != null ? totalHours * hourlyRate : 0
  return { grossPay, finalPay: grossPay + adjustment }
}
