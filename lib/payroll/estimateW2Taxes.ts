import type { DeductionCode } from '@prisma/client'
import type { PayDeductionInput } from '@/lib/payroll/deductions'
import { DEFAULT_LABELS } from '@/lib/payroll/deductions'
import { round2 } from '@/lib/payroll/hoursHmm'

/**
 * Estimated W-2 employee withholdings for NY hourly staff when no register /
 * legacy tax amounts are available.
 *
 * FICA rates are statutory. FIT / NYIT defaults are median effective rates from
 * published Rise & Shine payroll registers (~1.2% federal, ~2.3% NY state).
 * Override via env if needed.
 */
function rateFromEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : fallback
}

export const W2_ESTIMATE_RATES = {
  /** Social Security employee share */
  ss: () => rateFromEnv('PAYROLL_W2_SS_RATE', 0.062),
  /** Medicare employee share */
  medicare: () => rateFromEnv('PAYROLL_W2_MEDICARE_RATE', 0.0145),
  /** Federal income tax (estimated effective) */
  fedIncome: () => rateFromEnv('PAYROLL_W2_FIT_RATE', 0.012),
  /** NY State income tax (estimated effective) */
  nyState: () => rateFromEnv('PAYROLL_W2_NYIT_RATE', 0.023),
} as const

function row(
  code: DeductionCode,
  amount: number,
  estimated: boolean
): PayDeductionInput | null {
  const n = round2(amount)
  if (!(n > 0)) return null
  const base = DEFAULT_LABELS[code]
  return {
    code,
    label: estimated ? `${base} (est.)` : base,
    amount: n,
    employeePaid: true,
  }
}

/**
 * Build itemized employee tax rows from gross wages.
 * Always marks labels as estimated so stubs stay honest.
 */
export function estimateW2EmployeeDeductions(
  grossPay: number
): PayDeductionInput[] {
  const gross = round2(grossPay)
  if (!(gross > 0)) return []

  const parts = [
    row('FED_INCOME', gross * W2_ESTIMATE_RATES.fedIncome(), true),
    row('SS', gross * W2_ESTIMATE_RATES.ss(), true),
    row('MEDICARE', gross * W2_ESTIMATE_RATES.medicare(), true),
    row('NY_STATE', gross * W2_ESTIMATE_RATES.nyState(), true),
  ]

  return parts.filter((r): r is PayDeductionInput => r != null)
}

export function estimatedW2DeductionTotal(grossPay: number): number {
  return round2(
    estimateW2EmployeeDeductions(grossPay).reduce((s, d) => s + d.amount, 0)
  )
}
