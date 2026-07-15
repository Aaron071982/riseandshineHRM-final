/**
 * Name matching for YTD back-fill wizard.
 * Never auto-applies fuzzy matches (no name-flip guesses).
 */
import { distance } from 'fastest-levenshtein'
import type { PayrollMatchCandidate, PayrollMatchResult } from './types'

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
}

function tokens(name: string): Set<string> {
  return new Set(normalizeName(name).split(' ').filter(Boolean))
}

/** Token-set ratio (Jaccard) on punctuation-stripped tokens. */
export function tokenSetRatio(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : inter / union
}

function fullName(c: PayrollMatchCandidate): string {
  return `${c.firstName} ${c.lastName}`.trim()
}

function lastFirst(c: PayrollMatchCandidate): string {
  return `${c.lastName}, ${c.firstName}`.trim()
}

function levRatio(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  return 1 - distance(na, nb) / maxLen
}

/**
 * Match order (YTD batch):
 * 1. exact rbt_profiles.payrollName → MATCHED 1.0
 * 2. exact case-insensitive "LAST, FIRST" from profile → MATCHED 0.95
 * 3. fuzzy (token-set / lev) ≥ 0.85 → NEEDS_REVIEW, suggestion only (not applied)
 * 4. else UNMATCHED
 */
export function matchPayrollNameForYtd(
  payrollName: string,
  candidates: PayrollMatchCandidate[]
): PayrollMatchResult {
  const remembered = candidates.find((c) => c.payrollName === payrollName)
  if (remembered) {
    return {
      matchStatus: 'MATCHED',
      matchConfidence: 1,
      rbtProfileId: remembered.id,
      suggestedRbtProfileId: null,
    }
  }

  const exactLastFirst = candidates.find(
    (c) => normalizeName(lastFirst(c)) === normalizeName(payrollName)
  )
  if (exactLastFirst) {
    return {
      matchStatus: 'MATCHED',
      matchConfidence: 0.95,
      rbtProfileId: exactLastFirst.id,
      suggestedRbtProfileId: null,
    }
  }

  let best: { candidate: PayrollMatchCandidate; score: number } | null = null
  for (const c of candidates) {
    const score = Math.max(
      tokenSetRatio(payrollName, fullName(c)),
      tokenSetRatio(payrollName, lastFirst(c)),
      levRatio(payrollName, fullName(c)),
      levRatio(payrollName, lastFirst(c))
    )
    if (!best || score > best.score) best = { candidate: c, score }
  }

  if (best && best.score >= 0.85) {
    return {
      matchStatus: 'NEEDS_REVIEW',
      matchConfidence: best.score,
      rbtProfileId: null,
      suggestedRbtProfileId: best.candidate.id,
    }
  }

  return {
    matchStatus: 'UNMATCHED',
    matchConfidence: best?.score ?? 0,
    rbtProfileId: null,
    suggestedRbtProfileId: best && best.score >= 0.4 ? best.candidate.id : null,
  }
}
