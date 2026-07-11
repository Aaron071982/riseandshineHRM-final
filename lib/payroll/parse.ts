import * as XLSX from 'xlsx'
import type { ParsedPayrollEmployeeRow, PayrollParseResult } from './types'

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function cellNum(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).replace(/[$,\s]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** Parse Excel serial date or common US date strings */
export function parsePayrollDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()))
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date → UTC calendar day
    const epoch = Date.UTC(1899, 11, 30)
    const ms = epoch + v * 86400000
    const d = new Date(ms)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += 2000
    return new Date(Date.UTC(year, month - 1, day))
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  return null
}

export function parseTimePeriod(raw: string | null): { start: Date | null; end: Date | null } {
  if (!raw) return { start: null, end: null }
  const parts = raw.split(/\s*[-–—]\s*/)
  if (parts.length >= 2) {
    return { start: parsePayrollDate(parts[0]), end: parsePayrollDate(parts[1]) }
  }
  return { start: null, end: null }
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .trim()
}

type ColMap = {
  name?: number
  payDate?: number
  timePeriod?: number
  hours?: number
  gross?: number
  adjustedGross?: number
  empTaxTotal?: number
  empTaxFIT?: number
  empTaxSS?: number
  empTaxMed?: number
  empTaxNYIT?: number
  netPay?: number
  employerTaxTotal?: number
  totalPayrollCost?: number
}

function setCol(map: ColMap, key: keyof ColMap, c: number) {
  // First match wins — file has both short ("FIT") and long ("Federal Income Tax")
  // duplicates; short columns have per-employee values.
  if (map[key] == null) map[key] = c
}

function findHeaderRow(aoa: unknown[][]): { rowIndex: number; map: ColMap } | null {
  const maxScan = Math.min(aoa.length, 15)
  for (let r = 0; r < maxScan; r++) {
    const row = aoa[r] ?? []
    const map: ColMap = {}
    for (let c = 0; c < row.length; c++) {
      const h = normHeader(cellStr(row[c]))
      if (!h) continue
      if (h === 'name') setCol(map, 'name', c)
      else if (h === 'pay date' || h === 'paydate') setCol(map, 'payDate', c)
      else if (h === 'time period' || h === 'timeperiod' || h === 'period') setCol(map, 'timePeriod', c)
      else if (h === 'hours - total' || h === 'hours total') setCol(map, 'hours', c)
      else if (h === 'gross pay - total' || h === 'gross pay total' || h === 'gross pay') setCol(map, 'gross', c)
      else if (h === 'adjusted gross') setCol(map, 'adjustedGross', c)
      else if (h === 'employee taxes - total' || h === 'employee taxes total') setCol(map, 'empTaxTotal', c)
      else if (h === 'employee taxes - fit' || h === 'employee taxes - federal income tax')
        setCol(map, 'empTaxFIT', c)
      else if (h === 'employee taxes - ss' || h === 'employee taxes - social security')
        setCol(map, 'empTaxSS', c)
      else if (h === 'employee taxes - med' || h === 'employee taxes - medicare')
        setCol(map, 'empTaxMed', c)
      else if (
        h === 'employee taxes - ny it' ||
        h === 'employee taxes - ny income tax' ||
        h === 'employee taxes - nyit'
      )
        setCol(map, 'empTaxNYIT', c)
      else if (h === 'net pay' || h === 'netpay') setCol(map, 'netPay', c)
      else if (
        h === 'employer taxes & contributions - total' ||
        h === 'employer taxes - total' ||
        h === 'employer taxes total'
      )
        setCol(map, 'employerTaxTotal', c)
      else if (h === 'total payroll cost' || h === 'total payroll') setCol(map, 'totalPayrollCost', c)
    }
    if (map.name != null && (map.netPay != null || map.gross != null)) {
      return { rowIndex: r, map }
    }
  }
  return null
}

function isTotalRow(name: string): boolean {
  const n = name.trim().toLowerCase()
  return n === 'total' || n === 'totals' || n.startsWith('total ') || n === 'grand total'
}

function readRow(row: unknown[], map: ColMap): ParsedPayrollEmployeeRow {
  const payrollName = cellStr(map.name != null ? row[map.name] : '')
  const timePeriodRaw = map.timePeriod != null ? cellStr(row[map.timePeriod]) || null : null
  const { start, end } = parseTimePeriod(timePeriodRaw)
  // Register stores withholdings as negatives; store absolute deduction amounts
  const tax = (v: unknown) => Math.abs(cellNum(v))
  return {
    payrollName,
    payDate: map.payDate != null ? parsePayrollDate(row[map.payDate]) : null,
    periodStart: start,
    periodEnd: end,
    timePeriodRaw,
    totalHours: map.hours != null ? cellNum(row[map.hours]) : 0,
    grossPay: map.gross != null ? cellNum(row[map.gross]) : 0,
    adjustedGross: map.adjustedGross != null ? cellNum(row[map.adjustedGross]) : 0,
    empTaxTotal: map.empTaxTotal != null ? tax(row[map.empTaxTotal]) : 0,
    empTaxFIT: map.empTaxFIT != null ? tax(row[map.empTaxFIT]) : 0,
    empTaxSS: map.empTaxSS != null ? tax(row[map.empTaxSS]) : 0,
    empTaxMed: map.empTaxMed != null ? tax(row[map.empTaxMed]) : 0,
    empTaxNYIT: map.empTaxNYIT != null ? tax(row[map.empTaxNYIT]) : 0,
    netPay: map.netPay != null ? cellNum(row[map.netPay]) : 0,
    employerTaxTotal: map.employerTaxTotal != null ? Math.abs(cellNum(row[map.employerTaxTotal])) : 0,
    totalPayrollCost: map.totalPayrollCost != null ? cellNum(row[map.totalPayrollCost]) : 0,
  }
}

function formatLabel(periodStart: Date | null, periodEnd: Date | null, payDate: Date | null): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  if (periodStart && periodEnd) return `${fmt(periodStart)} – ${fmt(periodEnd)}`
  if (payDate) return `Pay date ${fmt(payDate)}`
  return 'Payroll run'
}

/**
 * Parse a finished payroll register (.xls / .xlsx).
 * Header row detected by column names; Total row excluded from employee rows.
 */
export function parsePayrollRegister(buffer: Buffer): PayrollParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets')
  const sheet = workbook.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  const header = findHeaderRow(aoa)
  if (!header) {
    throw new Error('Could not find payroll header row (expected Name, Net pay / Gross pay columns)')
  }

  const rows: ParsedPayrollEmployeeRow[] = []
  let totalsRow: ParsedPayrollEmployeeRow | null = null

  for (let r = header.rowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? []
    const name = cellStr(header.map.name != null ? row[header.map.name] : '')
    if (!name) continue
    const parsed = readRow(row, header.map)
    if (isTotalRow(name)) {
      totalsRow = parsed
      continue
    }
    rows.push(parsed)
  }

  if (rows.length === 0) throw new Error('No employee rows found in payroll register')

  const payDate = rows.find((r) => r.payDate)?.payDate ?? null
  const periodStart = rows.find((r) => r.periodStart)?.periodStart ?? null
  const periodEnd = rows.find((r) => r.periodEnd)?.periodEnd ?? null

  return {
    rows,
    totalsRow,
    payDate,
    periodStart,
    periodEnd,
    label: formatLabel(periodStart, periodEnd, payDate),
    sourceMeta: { sheetName, dataRowCount: rows.length },
  }
}
