import { distance } from 'fastest-levenshtein'
import type { PayrollMatchCandidate, PayrollMatchResult } from './types'

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
}

/** "Last, First" → "First Last" */
export function payrollNameToFirstLast(payrollName: string): string {
  const raw = payrollName.trim()
  if (!raw.includes(',')) return raw
  const [last, ...rest] = raw.split(',')
  const first = rest.join(',').trim()
  return `${first} ${last.trim()}`.replace(/\s+/g, ' ').trim()
}

function fullName(c: PayrollMatchCandidate): string {
  return `${c.firstName} ${c.lastName}`.trim()
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

/**
 * Match payroll register "Last, First" to an RBT profile.
 * 1) Remembered payrollName exact
 * 2) Exact "First Last" after flipping Last, First
 * 3) Fuzzy vs full name (and flipped forms)
 */
export function matchPayrollNameToRbt(
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

  const firstLast = payrollNameToFirstLast(payrollName)
  const exact = candidates.find((c) => normalizeName(fullName(c)) === normalizeName(firstLast))
  if (exact) {
    return {
      matchStatus: 'MATCHED',
      matchConfidence: 1,
      rbtProfileId: exact.id,
      suggestedRbtProfileId: null,
    }
  }

  let best: { candidate: PayrollMatchCandidate; score: number } | null = null
  for (const c of candidates) {
    const scores = [
      similarity(firstLast, fullName(c)),
      similarity(payrollName, fullName(c)),
      similarity(firstLast, `${c.lastName} ${c.firstName}`),
      // First-name-only soft signal for nicknames (Lara / Omolara) — capped
      Math.min(0.84, similarity(firstLast.split(' ')[0] ?? '', c.firstName) * 0.9 +
        similarity(firstLast.split(' ').slice(-1)[0] ?? '', c.lastName) * 0.9),
    ]
    const score = Math.max(...scores)
    if (!best || score > best.score) best = { candidate: c, score }
  }

  if (!best || best.score < 0.6) {
    return {
      matchStatus: 'UNMATCHED',
      matchConfidence: best?.score ?? 0,
      rbtProfileId: null,
      suggestedRbtProfileId: best && best.score >= 0.4 ? best.candidate.id : null,
    }
  }

  const status = best.score > 0.85 ? 'MATCHED' : 'NEEDS_REVIEW'
  return {
    matchStatus: status,
    matchConfidence: best.score,
    rbtProfileId: status === 'MATCHED' ? best.candidate.id : null,
    suggestedRbtProfileId: best.candidate.id,
  }
}
