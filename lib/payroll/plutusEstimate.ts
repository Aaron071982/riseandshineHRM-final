import { DEFAULT_RATES } from '@/lib/artemis/parse'
import { UNITS_PER_HOUR } from '@/lib/artemis/metrics'
import { round2 } from '@/lib/payroll/hoursHmm'

/**
 * Estimate Plutus billed revenue for sessions overlapping a pay period.
 * Uses NY Medicaid / Commercial / Tricare unit rates from DEFAULT_RATES
 * (same card as the operations Artemis dashboard). Prefer procedureCode
 * when present; otherwise treat hours as 97153 (direct therapy).
 */
export function estimatePlutusBilled(sessions: {
  procedureCode: string | null
  actualMinutes: number
  /** Optional payer hint; defaults to Medicaid schedule. */
  payerType?: 'Medicaid' | 'Commercial' | 'Tricare'
}[]): number {
  let total = 0
  for (const s of sessions) {
    if (!(s.actualMinutes > 0)) continue
    const units = (s.actualMinutes / 60) * UNITS_PER_HOUR
    const payer = s.payerType ?? 'Medicaid'
    const cpt = (s.procedureCode ?? '97153').replace(/\D/g, '').slice(0, 5) || '97153'
    const rate = DEFAULT_RATES[payer]?.[cpt] ?? DEFAULT_RATES.Medicaid['97153'] ?? 0
    total += units * rate
  }
  return round2(total)
}

/** Fallback when no BillingSession rows: RBT hours × 97153 + BCBA hours × 97155. */
export function estimatePlutusFromHours(input: {
  rbtHours: number
  bcbaHours: number
}): number {
  const rbt =
    input.rbtHours * UNITS_PER_HOUR * (DEFAULT_RATES.Medicaid['97153'] ?? 0)
  const bcba =
    input.bcbaHours * UNITS_PER_HOUR * (DEFAULT_RATES.Medicaid['97155'] ?? 0)
  return round2(rbt + bcba)
}
