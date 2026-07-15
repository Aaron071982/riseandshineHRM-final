import type { SnapshotEmployee, SnapshotLine } from './ytd-snapshot-parser'
import { round2 } from './ytd-snapshot-parser'

export function lineAmount(lines: SnapshotLine[], rawType: string): number {
  return round2(lines.filter((l) => l.rawType === rawType).reduce((a, l) => a + l.amount, 0))
}

export function sumLineTypes(lines: SnapshotLine[], types: string[]): number {
  const set = new Set(types)
  return round2(lines.filter((l) => set.has(l.rawType)).reduce((a, l) => a + l.amount, 0))
}

/** STATE-* except STATE-NY */
export function empTaxStateOther(lines: SnapshotLine[]): number {
  return round2(
    lines
      .filter((l) => l.rawType.startsWith('STATE-') && l.rawType !== 'STATE-NY')
      .reduce((a, l) => a + l.amount, 0)
  )
}

export function hasPayActivity(e: SnapshotEmployee, eps = 0.02): boolean {
  return (
    e.totalGross > eps ||
    e.netPay > eps ||
    e.totalHours > eps ||
    e.reportedTotalValues > eps
  )
}

export function mapTaxScalars(emp: SnapshotEmployee) {
  return {
    empTaxFIT: lineAmount(emp.employeeTaxes, 'FED WTH'),
    empTaxSS: lineAmount(emp.employeeTaxes, 'FICA'),
    empTaxMed: lineAmount(emp.employeeTaxes, 'MEDFICA'),
    empTaxNYIT: lineAmount(emp.employeeTaxes, 'STATE-NY'),
    empTaxLocal: sumLineTypes(emp.employeeTaxes, ['NEW YOR', 'YONKER']),
    empTaxStateOther: empTaxStateOther(emp.employeeTaxes),
  }
}
