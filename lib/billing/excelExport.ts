import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { calendarDateForExcel } from './calendarDate'
import {
  computePayableHours,
  computeStatusBreakdown,
  normalizeArtemisStatus,
  parsePayableStatusesJson,
  payableStatusLabels,
  PAYABLE_STATUS_OPTIONS,
  type ArtemisSessionStatusKey,
} from './sessionStatus'

type ExportEntry = {
  id: string
  providerNameRaw: string
  totalSessions: number
  totalHours: number
  hourlyRate: number | null
  grossPay: number
  adjustment: number
  adjustmentNote: string | null
  finalPay: number
  notes: string | null
  role: string | null
  rbtProfile: { firstName: string; lastName: string } | null
  payrollOnly: { fullName: string } | null
  sessions: {
    clientName: string
    dos: Date
    actualMinutes: number
    procedureCode: string | null
    location: string | null
    sessionStatus: string | null
    rawStatus: string | null
  }[]
}

type ExportCycle = {
  label: string
  periodStart: Date
  periodEnd: Date
  payableStatuses: unknown
  filtered?: boolean
}

const TEAL = 'FF0D9488'
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }

function employeeName(entry: ExportEntry): string {
  if (entry.rbtProfile) {
    return `${entry.rbtProfile.firstName} ${entry.rbtProfile.lastName}`.trim()
  }
  if (entry.payrollOnly) return entry.payrollOnly.fullName
  return entry.providerNameRaw
}

export async function buildPayrollWorkbook(
  cycle: ExportCycle,
  entries: ExportEntry[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Rise and Shine HRM'
  const payableStatuses = parsePayableStatusesJson(cycle.payableStatuses)
  const payableSet = new Set(payableStatuses)

  const summary = workbook.addWorksheet('Payroll Summary')
  summary.mergeCells('A1:L1')
  summary.getCell('A1').value = 'RISE AND SHINE ABA — PAYROLL'
  summary.getCell('A1').font = { bold: true, size: 16 }

  summary.mergeCells('A2:L2')
  summary.getCell('A2').value = `${cycle.label} (${format(cycle.periodStart, 'M/d/yyyy')} – ${format(cycle.periodEnd, 'M/d/yyyy')})`
  summary.getCell('A2').font = { italic: true, size: 11 }

  summary.mergeCells('A3:L3')
  summary.getCell('A3').value = `Payable statuses: ${payableStatusLabels(payableStatuses)}`
  summary.getCell('A3').font = { size: 10, italic: true }

  if (cycle.filtered) {
    summary.mergeCells('A4:L4')
    summary.getCell('A4').value = 'Note: export reflects active table filters'
    summary.getCell('A4').font = { size: 10, italic: true, color: { argb: 'FF6B7280' } }
  }

  const headerStartRow = cycle.filtered ? 5 : 4
  const headers = [
    'Employee',
    'Rate',
    ...PAYABLE_STATUS_OPTIONS.map((o) => `${o.label} Hrs`),
    'PAYABLE Hrs',
    'Adjustment',
    'FINAL PAY',
    'Notes',
  ]
  const headerRow = summary.getRow(headerStartRow)
  headerRow.values = headers
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  const totals = {
    breakdown: computeStatusBreakdown([]),
    payableHours: 0,
    adjustment: 0,
    finalPay: 0,
  }
  for (const key of PAYABLE_STATUS_OPTIONS.map((o) => o.key)) {
    totals.breakdown[key] = 0
  }

  for (const e of entries) {
    const breakdown = computeStatusBreakdown(e.sessions)
    const payableHours = computePayableHours(e.sessions, payableStatuses)
    const rate = e.hourlyRate ?? 0
    const finalPay = rate * payableHours + e.adjustment
    const noteParts = [e.adjustmentNote, e.notes].filter(Boolean)

    const row = summary.addRow([
      employeeName(e),
      e.hourlyRate,
      ...PAYABLE_STATUS_OPTIONS.map((o) => breakdown[o.key]),
      payableHours,
      e.adjustment,
      finalPay,
      noteParts.join(' | ') || '',
    ])
    row.getCell(2).numFmt = '$#,##0.00'
    PAYABLE_STATUS_OPTIONS.forEach((_, i) => {
      row.getCell(3 + i).numFmt = '0.00'
    })
    row.getCell(3 + PAYABLE_STATUS_OPTIONS.length).numFmt = '0.00'
    row.getCell(4 + PAYABLE_STATUS_OPTIONS.length).numFmt = '$#,##0.00'
    row.getCell(5 + PAYABLE_STATUS_OPTIONS.length).numFmt = '$#,##0.00'

    for (const key of PAYABLE_STATUS_OPTIONS.map((o) => o.key)) {
      totals.breakdown[key] += breakdown[key]
    }
    totals.payableHours += payableHours
    totals.adjustment += e.adjustment
    totals.finalPay += finalPay
  }

  const totalsRow = summary.addRow([
    'TOTALS',
    '',
    ...PAYABLE_STATUS_OPTIONS.map((o) => totals.breakdown[o.key]),
    totals.payableHours,
    totals.adjustment,
    totals.finalPay,
    '',
  ])
  totalsRow.font = { bold: true }
  PAYABLE_STATUS_OPTIONS.forEach((_, i) => {
    totalsRow.getCell(3 + i).numFmt = '0.00'
  })
  totalsRow.getCell(3 + PAYABLE_STATUS_OPTIONS.length).numFmt = '0.00'
  totalsRow.getCell(5 + PAYABLE_STATUS_OPTIONS.length).numFmt = '$#,##0.00'

  summary.columns.forEach((col) => {
    col.width = 14
  })
  summary.getColumn(1).width = 24

  const detail = workbook.addWorksheet('Session Detail')
  const detailHeaders = [
    'Employee',
    'Client',
    'Date',
    'Status',
    'Actual Hours',
    'Procedure Code',
    'Payable?',
  ]
  const detailHeaderRow = detail.addRow(detailHeaders)
  detailHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
  })

  for (const e of entries) {
    const name = employeeName(e)
    for (const s of e.sessions) {
      const key = normalizeArtemisStatus(s.sessionStatus)
      const isPayable = key != null && payableSet.has(key)
      const row = detail.addRow([
        name,
        s.clientName,
        calendarDateForExcel(s.dos),
        s.rawStatus ?? s.sessionStatus ?? '',
        s.actualMinutes / 60,
        s.procedureCode ?? '',
        isPayable ? 'Yes' : 'No',
      ])
      row.getCell(3).numFmt = 'm/d/yyyy'
      row.getCell(5).numFmt = '0.00'
    }
  }
  detail.columns.forEach((col) => {
    col.width = 16
  })
  detail.getColumn(1).width = 22

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export function payrollExportFilename(periodStart: Date, periodEnd: Date): string {
  return `RiseAndShine_Payroll_${format(periodStart, 'yyyy-MM-dd')}_to_${format(periodEnd, 'yyyy-MM-dd')}.xlsx`
}
