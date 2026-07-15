/**
 * Pure parser for vendor Year-to-Date payroll .xls exports (block-per-employee).
 * No DB / Next.js imports.
 */
import * as XLSX from 'xlsx'

export type SnapshotLine = { rawType: string; amount: number }
export type SnapshotEarningLine = { rawType: string; units: number; gross: number }

export type SnapshotEmployee = {
  rawName: string
  payrollEmployeeId: string | null
  earnings: SnapshotEarningLine[]
  employeeTaxes: SnapshotLine[]
  employeeDeductions: SnapshotLine[]
  employerTaxes: SnapshotLine[]
  employerDeductions: SnapshotLine[]
  reportedTotalValues: number
  totalGross: number
  totalEmployeeTax: number
  totalEmployeeDeductions: number
  totalEmployerTax: number
  totalEmployerDeductions: number
  netPay: number
  isContractor: boolean
  totalHours: number
}

export type ParsedSnapshot = {
  fileName: string
  companyName: string
  periodStart: Date
  periodEnd: Date
  reportCreatedAt: Date | null
  employees: SnapshotEmployee[]
  grandTotal: SnapshotEmployee
  warnings: string[]
}

const KNOWN_EARNINGS = new Set(['REGULAR', '1099$$'])
const KNOWN_EMP_TAX = new Set([
  'FICA',
  'MEDFICA',
  'FED WTH',
  'STATE-NY',
  'STATE-NJ',
  'NEW YOR',
  'YONKER',
  'DISAB-NJ',
  'NJ FLI',
  'NJSWF',
  'NJWFEE',
  'NJ SUI EE',
])
const KNOWN_EMP_DED = new Set(['NY PFL', 'NYDISAB'])
const KNOWN_ER_TAX = new Set([
  'NY RS',
  'CO MEDC',
  'CO FICA',
  'CO UNEM-NY',
  'CO UNEM-NJ',
  'FUTA',
  'NY MTA',
  'ER SDI-NJ',
  'NJWFER',
])

const BLOCK_START_BLOCKLIST = new Set([
  'TOTAL:',
  'TYPE',
  'EARNINGS',
  'REGULAR',
  '1099$$',
  'EMPLOYEE TAXES',
  'EMPLOYEE DEDUCTIONS',
  'EMPLOYER TAXES',
  'EMPLOYER DEDUCTIONS',
  'VALUES',
  'GROSS PAY',
  'AMOUNT',
])

const MONEY_EPS = 0.02

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Preserve decimals for amounts that come through as numbers
    return String(v)
  }
  return String(v).trim()
}

function isBlank(v: unknown): boolean {
  const s = cellStr(v)
  return s === '' || s === '\t'
}

function toGrid(buf: Buffer): string[][] {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Workbook has no sheets')
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: '',
  }) as unknown[][]
  return rows.map((row) => {
    const out: string[] = []
    const len = Math.max(row?.length ?? 0, 32)
    for (let c = 0; c < len; c++) {
      out.push(cellStr(row?.[c]))
    }
    return out
  })
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

/** Parse `MMM DD, YYYY` as UTC midnight (stable labels / diffs). */
export function parseMmmDdYyyy(raw: string): Date {
  const m = raw.trim().match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (!m) throw new Error(`Invalid period date: ${raw}`)
  const mon = MONTHS[m[1].toLowerCase()]
  if (mon == null) throw new Error(`Invalid month in date: ${raw}`)
  const day = Number(m[2])
  const year = Number(m[3])
  return new Date(Date.UTC(year, mon, day))
}

function parseReportCreated(raw: string): Date | null {
  const m = raw.match(
    /Report Created:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
  )
  if (!m) return null
  let hour = Number(m[4])
  const min = Number(m[5])
  const ampm = m[6].toUpperCase()
  if (ampm === 'PM' && hour < 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  // Store as UTC of the local wall clock shown (no TZ conversion)
  return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hour, min))
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) throw new Error(`Invalid money: ${raw}`)
  return round2(n)
}

function parseNum(raw: string): number {
  if (isBlank(raw)) return 0
  const n = Number(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  return n
}

function firstNonEmpty(row: string[], from: number, to: number): number {
  for (let c = from; c <= to; c++) {
    if (!isBlank(row[c])) return parseNum(row[c])
  }
  return 0
}

function isBlockStart(row: string[]): boolean {
  const name = row[0] ?? ''
  if (isBlank(name)) return false
  if (BLOCK_START_BLOCKLIST.has(name)) return false
  if (name.startsWith('ID:')) return false
  if (name.startsWith('*')) return false
  if (name === '\t') return false
  // every other cell empty
  for (let c = 1; c < row.length; c++) {
    if (!isBlank(row[c])) return false
  }
  return true
}

function sumLines(lines: SnapshotLine[]): number {
  return round2(lines.reduce((a, l) => a + l.amount, 0))
}

function sumEarningGross(lines: SnapshotEarningLine[]): number {
  return round2(lines.reduce((a, l) => a + l.gross, 0))
}

function parseCategoryLines(
  block: string[][],
  typeCol: number,
  valueFn: (row: string[]) => number,
  startRow: number,
  totalRowIdx: number
): SnapshotLine[] {
  const lines: SnapshotLine[] = []
  for (let r = startRow; r < totalRowIdx; r++) {
    const t = block[r]?.[typeCol] ?? ''
    if (isBlank(t) || t === 'TOTAL:') break
    lines.push({ rawType: t, amount: round2(valueFn(block[r])) })
  }
  return lines
}

function parseEarningLines(
  block: string[][],
  startRow: number,
  totalRowIdx: number
): SnapshotEarningLine[] {
  const lines: SnapshotEarningLine[] = []
  for (let r = startRow; r < totalRowIdx; r++) {
    const t = block[r]?.[0] ?? ''
    if (isBlank(t) || t === 'TOTAL:') break
    lines.push({
      rawType: t,
      units: round2(firstNonEmpty(block[r], 1, 6)),
      gross: round2(parseNum(block[r][7] ?? '')),
    })
  }
  return lines
}

function parseBlock(name: string, blockRows: string[][], warnings: string[]): SnapshotEmployee {
  let netPay = 0
  let payrollEmployeeId: string | null = null
  let typeHeaderIdx = -1
  let totalRowIdx = -1

  for (let r = 0; r < blockRows.length; r++) {
    const row = blockRows[r]
    for (const cell of row) {
      if (cell.startsWith('NET PAY')) {
        const moneyPart = cell.replace(/^NET PAY\s*/i, '').trim()
        netPay = parseMoney(moneyPart)
      }
    }
    const c0 = row[0] ?? ''
    if (c0.startsWith('ID:')) {
      payrollEmployeeId = c0.slice(3).trim() || null
    }
    if (c0 === 'TYPE') typeHeaderIdx = r
    if (c0 === 'TOTAL:') totalRowIdx = r
  }

  if (typeHeaderIdx < 0) {
    throw new Error(`Block "${name}": missing TYPE header row`)
  }
  if (totalRowIdx < 0) {
    throw new Error(`Block "${name}": missing TOTAL: row`)
  }

  const itemStart = typeHeaderIdx + 1
  const earnings = parseEarningLines(blockRows, itemStart, totalRowIdx)
  const employeeTaxes = parseCategoryLines(
    blockRows,
    8,
    (row) => firstNonEmpty(row, 9, 10),
    itemStart,
    totalRowIdx
  )
  const employeeDeductions = parseCategoryLines(
    blockRows,
    11,
    (row) => parseNum(row[12] ?? ''),
    itemStart,
    totalRowIdx
  )
  const employerTaxes = parseCategoryLines(
    blockRows,
    14,
    (row) => firstNonEmpty(row, 15, 16),
    itemStart,
    totalRowIdx
  )
  const employerDeductions = parseCategoryLines(
    blockRows,
    24,
    (row) => firstNonEmpty(row, 25, 31),
    itemStart,
    totalRowIdx
  )

  const totalRow = blockRows[totalRowIdx]
  const reportedTotalValues = round2(firstNonEmpty(totalRow, 1, 6))
  const totalGross = round2(parseNum(totalRow[7] ?? ''))
  const totalEmployeeTax = round2(firstNonEmpty(totalRow, 9, 10))
  const totalEmployeeDeductions = round2(parseNum(totalRow[12] ?? ''))
  const totalEmployerTax = round2(firstNonEmpty(totalRow, 15, 16))
  const totalEmployerDeductions = round2(firstNonEmpty(totalRow, 25, 31))

  // Line-item vs TOTAL: checksums
  const eg = sumEarningGross(earnings)
  if (Math.abs(eg - totalGross) > MONEY_EPS) {
    warnings.push(
      `${name}: earnings line sum ${eg.toFixed(2)} != TOTAL: gross ${totalGross.toFixed(2)}`
    )
  }
  const et = sumLines(employeeTaxes)
  if (Math.abs(et - totalEmployeeTax) > MONEY_EPS) {
    warnings.push(
      `${name}: employee tax line sum ${et.toFixed(2)} != TOTAL: ${totalEmployeeTax.toFixed(2)}`
    )
  }
  const ed = sumLines(employeeDeductions)
  if (Math.abs(ed - totalEmployeeDeductions) > MONEY_EPS) {
    warnings.push(
      `${name}: employee deduction line sum ${ed.toFixed(2)} != TOTAL: ${totalEmployeeDeductions.toFixed(2)}`
    )
  }
  const ert = sumLines(employerTaxes)
  if (Math.abs(ert - totalEmployerTax) > MONEY_EPS) {
    warnings.push(
      `${name}: employer tax line sum ${ert.toFixed(2)} != TOTAL: ${totalEmployerTax.toFixed(2)}`
    )
  }

  for (const e of earnings) {
    if (!KNOWN_EARNINGS.has(e.rawType)) {
      warnings.push(`${name}: unknown earnings type "${e.rawType}"`)
    }
  }
  for (const l of employeeTaxes) {
    if (!KNOWN_EMP_TAX.has(l.rawType)) {
      warnings.push(`${name}: unknown employee tax "${l.rawType}"`)
    }
  }
  for (const l of employeeDeductions) {
    if (!KNOWN_EMP_DED.has(l.rawType)) {
      warnings.push(`${name}: unknown employee deduction "${l.rawType}"`)
    }
  }
  for (const l of employerTaxes) {
    if (!KNOWN_ER_TAX.has(l.rawType)) {
      warnings.push(`${name}: unknown employer tax "${l.rawType}"`)
    }
  }
  for (const l of employerDeductions) {
    warnings.push(`${name}: unknown employer deduction "${l.rawType}"`)
  }

  if (name !== 'YEAR-TO-DATE TOTALS' && !payrollEmployeeId) {
    warnings.push(`${name}: missing ID: line`)
  }

  const hasRegular = earnings.some((e) => e.rawType === 'REGULAR')
  const has1099 = earnings.some((e) => e.rawType === '1099$$')
  const isContractor = !hasRegular && has1099
  const totalHours = round2(
    earnings.filter((e) => e.rawType === 'REGULAR').reduce((a, e) => a + e.units, 0)
  )

  return {
    rawName: name,
    payrollEmployeeId,
    earnings,
    employeeTaxes,
    employeeDeductions,
    employerTaxes,
    employerDeductions,
    reportedTotalValues,
    totalGross,
    totalEmployeeTax,
    totalEmployeeDeductions,
    totalEmployerTax,
    totalEmployerDeductions,
    netPay,
    isContractor,
    totalHours,
  }
}

export function parseYtdSnapshot(buf: Buffer, fileName: string): ParsedSnapshot {
  const grid = toGrid(buf)
  const warnings: string[] = []

  const companyName = grid[1]?.[0] ?? ''
  if (!companyName) {
    throw new Error(`${fileName}: missing company name at row 1 col 0`)
  }

  const reportType = grid[4]?.[0] ?? ''
  if (reportType !== 'Report Type: Year-to-Date') {
    throw new Error(
      `${fileName}: expected "Report Type: Year-to-Date" at row 4 col 0, got "${reportType}"`
    )
  }

  const periodStartRaw = grid[2]?.[23] ?? ''
  const periodEndRaw = grid[2]?.[30] ?? ''
  if (!periodStartRaw || !periodEndRaw) {
    throw new Error(`${fileName}: missing PERIOD START/END values at row 2`)
  }
  const periodStart = parseMmmDdYyyy(periodStartRaw)
  const periodEnd = parseMmmDdYyyy(periodEndRaw)

  if (
    periodStart.getUTCFullYear() !== periodEnd.getUTCFullYear() ||
    periodStart.getUTCMonth() !== 0 ||
    periodStart.getUTCDate() !== 1
  ) {
    throw new Error(
      `${fileName}: periodStart must be Jan 01 of the periodEnd year (got ${periodStartRaw})`
    )
  }

  const createdRaw = grid[6]?.[20] ?? ''
  const reportCreatedAt = createdRaw ? parseReportCreated(createdRaw) : null

  // Collect block starts from row 9
  const starts: { name: string; row: number }[] = []
  for (let r = 9; r < grid.length; r++) {
    if (isBlockStart(grid[r])) {
      starts.push({ name: grid[r][0], row: r })
    }
  }

  if (starts.length === 0) {
    warnings.push(`${fileName}: no employee blocks found`)
  }

  const blocks: { name: string; rows: string[][] }[] = []
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].row
    const end = i + 1 < starts.length ? starts[i + 1].row : grid.length
    blocks.push({ name: starts[i].name, rows: grid.slice(start, end) })
  }

  let grandTotal: SnapshotEmployee | null = null
  const employees: SnapshotEmployee[] = []

  for (const b of blocks) {
    const parsed = parseBlock(b.name, b.rows, warnings)
    if (b.name === 'YEAR-TO-DATE TOTALS') {
      grandTotal = parsed
    } else {
      employees.push(parsed)
    }
  }

  if (!grandTotal) {
    throw new Error(`${fileName}: missing YEAR-TO-DATE TOTALS block`)
  }
  if (employees.length === 0) {
    warnings.push(`${fileName}: employees.length === 0`)
  }

  return {
    fileName,
    companyName,
    periodStart,
    periodEnd,
    reportCreatedAt,
    employees,
    grandTotal,
    warnings,
  }
}

export function zeroEmployee(rawName = ''): SnapshotEmployee {
  return {
    rawName,
    payrollEmployeeId: null,
    earnings: [],
    employeeTaxes: [],
    employeeDeductions: [],
    employerTaxes: [],
    employerDeductions: [],
    reportedTotalValues: 0,
    totalGross: 0,
    totalEmployeeTax: 0,
    totalEmployeeDeductions: 0,
    totalEmployerTax: 0,
    totalEmployerDeductions: 0,
    netPay: 0,
    isContractor: false,
    totalHours: 0,
  }
}
