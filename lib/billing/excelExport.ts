import ExcelJS from 'exceljs'
import { format } from 'date-fns'

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
}

type ExportSession = {
  clientName: string
  dos: Date
  actualMinutes: number
  procedureCode: string | null
  location: string | null
  billingEntry: {
    providerNameRaw: string
    rbtProfile: { firstName: string; lastName: string } | null
  }
}

type ExportCycle = {
  label: string
  periodStart: Date
  periodEnd: Date
}

const ORANGE = 'FFE36F1E'
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
  entries: ExportEntry[],
  sessions: ExportSession[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Rise and Shine HRM'

  const summary = workbook.addWorksheet('Payroll Summary')
  summary.mergeCells('A1:J1')
  const titleCell = summary.getCell('A1')
  titleCell.value = 'RISE AND SHINE ABA — PAYROLL'
  titleCell.font = { bold: true, size: 16 }

  summary.mergeCells('A2:J2')
  const subCell = summary.getCell('A2')
  subCell.value = `${cycle.label} (${format(cycle.periodStart, 'M/d/yyyy')} – ${format(cycle.periodEnd, 'M/d/yyyy')})`
  subCell.font = { italic: true, size: 11 }

  const headers = [
    'ID',
    'Employee Name',
    'Pay Type',
    'Rate',
    'Total Sessions',
    'Total Hours',
    'Gross Pay',
    'Adjustment',
    'Final Pay',
    'Notes',
  ]
  const headerRow = summary.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  let sumHours = 0
  let sumGross = 0
  let sumFinal = 0

  for (const e of entries) {
    const noteParts = [e.adjustmentNote, e.notes].filter(Boolean)
    const row = summary.addRow([
      e.id.slice(-8).toUpperCase(),
      employeeName(e),
      e.role ?? 'RBT',
      e.hourlyRate,
      e.totalSessions,
      e.totalHours,
      e.grossPay,
      e.adjustment,
      e.finalPay,
      noteParts.join(' | ') || '',
    ])
    row.getCell(4).numFmt = '$#,##0.00'
    row.getCell(7).numFmt = '$#,##0.00'
    row.getCell(8).numFmt = '$#,##0.00'
    row.getCell(9).numFmt = '$#,##0.00'
    row.getCell(6).numFmt = '0.00'
    sumHours += e.totalHours
    sumGross += e.grossPay
    sumFinal += e.finalPay
  }

  const totalsRow = summary.addRow([
    '',
    'TOTALS',
    '',
    '',
    '',
    sumHours,
    sumGross,
    '',
    sumFinal,
    '',
  ])
  totalsRow.font = { bold: true }
  totalsRow.getCell(6).numFmt = '0.00'
  totalsRow.getCell(7).numFmt = '$#,##0.00'
  totalsRow.getCell(9).numFmt = '$#,##0.00'

  summary.columns.forEach((col) => {
    col.width = 16
  })
  summary.getColumn(2).width = 24

  const detail = workbook.addWorksheet('Session Detail')
  const detailHeaders = ['Employee', 'Client', 'Date', 'Actual Hours', 'Procedure Code', 'Location']
  const detailHeaderRow = detail.addRow(detailHeaders)
  detailHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    cell.font = HEADER_FONT
  })

  for (const s of sessions) {
    const name = s.billingEntry.rbtProfile
      ? `${s.billingEntry.rbtProfile.firstName} ${s.billingEntry.rbtProfile.lastName}`.trim()
      : s.billingEntry.providerNameRaw
    const row = detail.addRow([
      name,
      s.clientName,
      s.dos,
      s.actualMinutes / 60,
      s.procedureCode ?? '',
      s.location ?? '',
    ])
    row.getCell(3).numFmt = 'm/d/yyyy'
    row.getCell(4).numFmt = '0.00'
  }

  detail.columns.forEach((col) => {
    col.width = 18
  })
  detail.getColumn(1).width = 24
  detail.getColumn(2).width = 24

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export function payrollExportFilename(periodStart: Date, periodEnd: Date): string {
  return `RiseAndShine_Payroll_${format(periodStart, 'yyyy-MM-dd')}_to_${format(periodEnd, 'yyyy-MM-dd')}.xlsx`
}
