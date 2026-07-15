/**
 * Derive per-period payroll runs by differencing consecutive YTD snapshots.
 * Pure functions — no DB / Next.js imports.
 */
import {
  type ParsedSnapshot,
  type SnapshotEmployee,
  type SnapshotEarningLine,
  type SnapshotLine,
  round2,
  zeroEmployee,
} from './ytd-snapshot-parser'

export type DerivedRun = {
  payDate: Date
  periodStart: Date
  periodEnd: Date
  label: string
  sourceSnapshot: string
  entries: SnapshotEmployee[]
  grandTotalDelta: SnapshotEmployee
  checksumOk: boolean
  warnings: string[]
}

export class NegativeDeltaError extends Error {
  constructor(
    public readonly employee: string,
    public readonly field: string,
    public readonly prevSnapshot: string,
    public readonly currSnapshot: string,
    public readonly value: number
  ) {
    super(
      `Negative delta for ${employee} field ${field} (${prevSnapshot} → ${currSnapshot}): ${value}`
    )
    this.name = 'NegativeDeltaError'
  }
}

const EPS = 0.02

function addUtcDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
}

/** `MMM D, YYYY` (no leading zero) in UTC — matches existing payroll list labels. */
export function formatPeriodDay(d: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function formatRunLabel(periodStart: Date, periodEnd: Date): string {
  return `${formatPeriodDay(periodStart)} – ${formatPeriodDay(periodEnd)}`
}

function guardNonNeg(employee: string, field: string, value: number, prev: string, curr: string) {
  if (value < -EPS) {
    throw new NegativeDeltaError(employee, field, prev, curr, value)
  }
}

function diffScalar(
  employee: string,
  field: string,
  curr: number,
  prev: number,
  prevSnap: string,
  currSnap: string
): number {
  const d = round2(curr - prev)
  guardNonNeg(employee, field, d, prevSnap, currSnap)
  // Clamp tiny float noise to 0
  return Math.abs(d) < 1e-9 ? 0 : d
}

function diffAmountLines(
  employee: string,
  kind: string,
  curr: SnapshotLine[],
  prev: SnapshotLine[],
  prevSnap: string,
  currSnap: string
): SnapshotLine[] {
  const types = new Set([...curr.map((l) => l.rawType), ...prev.map((l) => l.rawType)])
  const out: SnapshotLine[] = []
  for (const rawType of types) {
    const c = curr.find((l) => l.rawType === rawType)?.amount ?? 0
    const p = prev.find((l) => l.rawType === rawType)?.amount ?? 0
    const amount = diffScalar(employee, `${kind}:${rawType}`, c, p, prevSnap, currSnap)
    if (amount !== 0 || c !== 0 || p !== 0) {
      out.push({ rawType, amount })
    }
  }
  return out
}

function diffEarningLines(
  employee: string,
  curr: SnapshotEarningLine[],
  prev: SnapshotEarningLine[],
  prevSnap: string,
  currSnap: string
): SnapshotEarningLine[] {
  const types = new Set([...curr.map((l) => l.rawType), ...prev.map((l) => l.rawType)])
  const out: SnapshotEarningLine[] = []
  for (const rawType of types) {
    const c = curr.find((l) => l.rawType === rawType)
    const p = prev.find((l) => l.rawType === rawType)
    const units = diffScalar(employee, `earnings.units:${rawType}`, c?.units ?? 0, p?.units ?? 0, prevSnap, currSnap)
    const gross = diffScalar(employee, `earnings.gross:${rawType}`, c?.gross ?? 0, p?.gross ?? 0, prevSnap, currSnap)
    if (units !== 0 || gross !== 0 || c || p) {
      out.push({ rawType, units, gross })
    }
  }
  return out
}

function diffEmployee(
  curr: SnapshotEmployee,
  prev: SnapshotEmployee,
  prevSnap: string,
  currSnap: string
): SnapshotEmployee {
  const name = curr.rawName
  const earnings = diffEarningLines(name, curr.earnings, prev.earnings, prevSnap, currSnap)
  const employeeTaxes = diffAmountLines(
    name,
    'empTax',
    curr.employeeTaxes,
    prev.employeeTaxes,
    prevSnap,
    currSnap
  )
  const employeeDeductions = diffAmountLines(
    name,
    'empDed',
    curr.employeeDeductions,
    prev.employeeDeductions,
    prevSnap,
    currSnap
  )
  const employerTaxes = diffAmountLines(
    name,
    'erTax',
    curr.employerTaxes,
    prev.employerTaxes,
    prevSnap,
    currSnap
  )
  const employerDeductions = diffAmountLines(
    name,
    'erDed',
    curr.employerDeductions,
    prev.employerDeductions,
    prevSnap,
    currSnap
  )

  const hasRegular = earnings.some((e) => e.rawType === 'REGULAR' && (e.units !== 0 || e.gross !== 0))
  const has1099 = earnings.some((e) => e.rawType === '1099$$' && (e.units !== 0 || e.gross !== 0))
  // Preserve contractor identity when period activity is 1099-only or YTD subject was contractor with no W2
  const isContractor =
    (!hasRegular && has1099) ||
    (curr.isContractor && !hasRegular)

  return {
    rawName: name,
    payrollEmployeeId: curr.payrollEmployeeId,
    earnings,
    employeeTaxes,
    employeeDeductions,
    employerTaxes,
    employerDeductions,
    reportedTotalValues: diffScalar(
      name,
      'reportedTotalValues',
      curr.reportedTotalValues,
      prev.reportedTotalValues,
      prevSnap,
      currSnap
    ),
    totalGross: diffScalar(name, 'totalGross', curr.totalGross, prev.totalGross, prevSnap, currSnap),
    totalEmployeeTax: diffScalar(
      name,
      'totalEmployeeTax',
      curr.totalEmployeeTax,
      prev.totalEmployeeTax,
      prevSnap,
      currSnap
    ),
    totalEmployeeDeductions: diffScalar(
      name,
      'totalEmployeeDeductions',
      curr.totalEmployeeDeductions,
      prev.totalEmployeeDeductions,
      prevSnap,
      currSnap
    ),
    totalEmployerTax: diffScalar(
      name,
      'totalEmployerTax',
      curr.totalEmployerTax,
      prev.totalEmployerTax,
      prevSnap,
      currSnap
    ),
    totalEmployerDeductions: diffScalar(
      name,
      'totalEmployerDeductions',
      curr.totalEmployerDeductions,
      prev.totalEmployerDeductions,
      prevSnap,
      currSnap
    ),
    netPay: diffScalar(name, 'netPay', curr.netPay, prev.netPay, prevSnap, currSnap),
    isContractor,
    totalHours: diffScalar(name, 'totalHours', curr.totalHours, prev.totalHours, prevSnap, currSnap),
  }
}

function sumField(entries: SnapshotEmployee[], field: keyof SnapshotEmployee): number {
  return round2(
    entries.reduce((a, e) => {
      const v = e[field]
      return a + (typeof v === 'number' ? v : 0)
    }, 0)
  )
}

export function deriveRunsFromSnapshots(snaps: ParsedSnapshot[]): DerivedRun[] {
  if (snaps.length === 0) return []

  const sorted = [...snaps].sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime())

  const year = sorted[0].periodEnd.getUTCFullYear()
  for (const s of sorted) {
    if (s.periodEnd.getUTCFullYear() !== year) {
      throw new Error(
        `Mixed calendar years in batch: ${sorted[0].fileName} (${year}) vs ${s.fileName} (${s.periodEnd.getUTCFullYear()})`
      )
    }
    if (
      s.periodStart.getUTCFullYear() !== year ||
      s.periodStart.getUTCMonth() !== 0 ||
      s.periodStart.getUTCDate() !== 1
    ) {
      throw new Error(
        `${s.fileName}: periodStart must be Jan 01, ${year}`
      )
    }
  }

  const runs: DerivedRun[] = []

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i]
    const prev = i === 0 ? null : sorted[i - 1]
    const prevSnapName = prev?.fileName ?? '(empty)'
    const payDate = curr.periodEnd
    const periodStart = i === 0 ? curr.periodStart : addUtcDays(prev!.periodEnd, 1)
    const periodEnd = curr.periodEnd
    const warnings = [...curr.warnings]
    if (prev) warnings.push(...prev.warnings.filter((w) => !warnings.includes(w)))

    const prevByName = new Map((prev?.employees ?? []).map((e) => [e.rawName.trim(), e]))

    const entries: SnapshotEmployee[] = []
    for (const emp of curr.employees) {
      const key = emp.rawName.trim()
      const prevEmp = prevByName.get(key) ?? zeroEmployee(key)
      entries.push(diffEmployee(emp, prevEmp, prevSnapName, curr.fileName))
    }

    const grandPrev = prev?.grandTotal ?? zeroEmployee('YEAR-TO-DATE TOTALS')
    const grandTotalDelta = diffEmployee(curr.grandTotal, grandPrev, prevSnapName, curr.fileName)

    // Checksum: sum of employee deltas vs grand-total delta (vendor "hours" = reportedTotalValues)
    const checks: { field: keyof SnapshotEmployee; label: string }[] = [
      { field: 'reportedTotalValues', label: 'hours/values' },
      { field: 'totalGross', label: 'gross' },
      { field: 'totalEmployeeTax', label: 'employee tax' },
      { field: 'totalEmployeeDeductions', label: 'employee deductions' },
      { field: 'totalEmployerTax', label: 'employer tax' },
      { field: 'netPay', label: 'net' },
    ]

    let checksumOk = true
    for (const { field, label } of checks) {
      const sum = sumField(entries, field)
      const gt = grandTotalDelta[field] as number
      if (Math.abs(sum - gt) > EPS) {
        checksumOk = false
        warnings.push(
          `${formatRunLabel(periodStart, periodEnd)}: checksum ${label} fail — employees ${sum.toFixed(2)} vs YTD TOTALS Δ ${gt.toFixed(2)}`
        )
      }
    }

    runs.push({
      payDate,
      periodStart,
      periodEnd,
      label: formatRunLabel(periodStart, periodEnd),
      sourceSnapshot: curr.fileName,
      entries,
      grandTotalDelta,
      checksumOk,
      warnings,
    })
  }

  return runs
}

/** Count employees with any period pay activity. */
export function countEmployeesWithPay(entries: SnapshotEmployee[]): number {
  return entries.filter(
    (e) =>
      e.totalGross > EPS ||
      e.netPay > EPS ||
      e.totalHours > EPS ||
      e.reportedTotalValues > EPS
  ).length
}
