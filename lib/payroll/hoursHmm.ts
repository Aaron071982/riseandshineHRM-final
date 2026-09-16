/**
 * Payroll h.mm clock math.
 * ".30" means 30 minutes (not decimal hours). Example: 4.30 → 6.30 = 2.00 h.
 * Distinct from schedule HH:MM helpers in lib/rbt-schedule/utils.ts.
 */

export function clockToMinutes(clock: string): number {
  const raw = String(clock ?? '').trim()
  if (!raw) return NaN
  const [hPart, mPart = '0'] = raw.split('.')
  const h = Number(hPart)
  if (!Number.isFinite(h) || h < 0) return NaN
  const m = Number(mPart.padEnd(2, '0').slice(0, 2))
  if (!Number.isFinite(m) || m < 0 || m >= 60) return NaN
  return h * 60 + m
}

/** Round to 2 decimal places (hours / money). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Hours between two h.mm clocks on the same work day.
 * Returns 0 when end ≤ start or clocks are invalid (no overnight spans).
 */
export function hoursBetween(start: string, end: string): number {
  const a = clockToMinutes(start)
  const b = clockToMinutes(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  return round2((b - a) / 60)
}

export function amountForHours(hours: number, ratePerHour: number): number {
  return round2(hours * ratePerHour)
}

export type LineAmount = { hours: number; amount: number }

export function computeLine(input: {
  startClock: string
  endClock: string
  ratePerHour: number
}): LineAmount {
  const hours = hoursBetween(input.startClock, input.endClock)
  return { hours, amount: amountForHours(hours, input.ratePerHour) }
}

export type StatementTotals = {
  totalHours: number
  grossPay: number
  deductions: number
  netPay: number
  lineAmountSum: number
  reconciled: boolean
}

/**
 * Totals from line items. Optional grossOverride trips reconciled=false when it
 * differs from Σ amount (line items remain the source of truth for the sum).
 */
export function recomputeStatementTotals(
  lineItems: { hours: number | string; amount: number | string }[],
  opts?: { deductions?: number; grossOverride?: number }
): StatementTotals {
  const totalHours = round2(
    lineItems.reduce((sum, li) => sum + Number(li.hours), 0)
  )
  const lineAmountSum = round2(
    lineItems.reduce((sum, li) => sum + Number(li.amount), 0)
  )
  const deductions = round2(opts?.deductions ?? 0)
  const grossFromLines = lineAmountSum
  const grossPay =
    opts?.grossOverride != null ? round2(opts.grossOverride) : grossFromLines
  const reconciled = Math.abs(grossPay - lineAmountSum) < 0.005
  const netPay = round2(grossPay - deductions)
  return {
    totalHours,
    grossPay,
    deductions,
    netPay,
    lineAmountSum,
    reconciled,
  }
}

/** Format Date (or UTC wall components) as h.mm for payroll line items. */
export function dateToHmmClock(d: Date, useUtc = true): string {
  const h = useUtc ? d.getUTCHours() : d.getHours()
  const m = useUtc ? d.getUTCMinutes() : d.getMinutes()
  return `${h}.${String(m).padStart(2, '0')}`
}
