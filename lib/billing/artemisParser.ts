import ExcelJS from 'exceljs'
import type { ArtemisParseResult, ParsedSessionRow, ProviderGroup } from './types'

const PAYROLL_ROLES = new Set(['rbt', 'bt'])
const EXCLUDED_ROLES = new Set(['bcba', 'clinical director'])

function normalizeRole(role: string): string {
  return role.trim().toLowerCase()
}

function isPayrollRole(role: string): boolean {
  const r = normalizeRole(role)
  return PAYROLL_ROLES.has(r)
}

function isExcludedRole(role: string): boolean {
  const r = normalizeRole(role)
  return EXCLUDED_ROLES.has(r) || (!PAYROLL_ROLES.has(r) && r.length > 0)
}

function parseMinutes(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const s = String(value).trim()
  if (!s) return 0
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parseDos(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = new Date(value)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const s = String(value).trim()
  if (!s) return null
  const parts = s.split(/[/-]/)
  if (parts.length >= 3) {
    const month = parseInt(parts[0], 10)
    const day = parseInt(parts[1], 10)
    let year = parseInt(parts[2], 10)
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0)
    return parsed
  }
  return null
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in v && typeof (v as { text: string }).text === 'string') {
    return (v as { text: string }).text.trim()
  }
  if (typeof v === 'object' && 'result' in v) {
    return String((v as { result: unknown }).result ?? '').trim()
  }
  return String(v).trim()
}

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[↑↓]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Artemis pivot export: only delivered/billable sessions count toward payroll. */
const BILLABLE_STATUSES = new Set(['completed', 'ready to bill'])

const SUMMARY_STATUSES = new Set(['subtotal', 'total', 'sum', 'count'])

function isSummaryStatus(status: string | null): boolean {
  return SUMMARY_STATUSES.has((status ?? '').trim().toLowerCase())
}

function isBillableArtemisStatus(status: string | null): boolean {
  return BILLABLE_STATUSES.has((status ?? '').trim().toLowerCase())
}

function isNonBillableArtemisStatus(status: string | null): boolean {
  const s = (status ?? '').trim().toLowerCase()
  if (!s) return true
  return !BILLABLE_STATUSES.has(s)
}

function categorizeSkippedStatus(status: string | null): string {
  const s = (status ?? '').trim().toLowerCase()
  if (!s) return 'unknown'
  if (/\bcancel/.test(s)) return 'cancelled'
  if (/\bdeleted\b/.test(s)) return 'deleted'
  if (/\bscheduled\b/.test(s)) return 'scheduled'
  if (/\bincomplete\b/.test(s)) return 'incomplete'
  if (/\bin progress\b/.test(s)) return 'in_progress'
  if (/\bno show\b/.test(s)) return 'no_show'
  return 'other'
}

function findStatusColumn(headers: Record<string, number>): {
  status?: number
  cancellationReason?: number
} {
  const result: { status?: number; cancellationReason?: number } = {}
  for (const [k, col] of Object.entries(headers)) {
    if (
      k === 'status' ||
      (k.startsWith('status') &&
        !k.includes('claim') &&
        !k.includes('case :'))
    ) {
      if (!result.status || k === 'status') result.status = col
    }
    if (
      k.includes('cancellation') ||
      k.includes('cancel reason') ||
      k === 'cancelled' ||
      k === 'canceled'
    ) {
      result.cancellationReason = col
    }
  }
  return result
}

function findHeaderRow(sheet: ExcelJS.Worksheet): { rowNumber: number; colMap: Record<string, number> } | null {
  const required = ['provider name', 'actual duration']
  for (let r = 1; r <= Math.min(sheet.rowCount, 50); r++) {
    const row = sheet.getRow(r)
    const headers: Record<string, number> = {}
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = normalizeHeaderKey(cellText(cell))
      if (key) headers[key] = col
    })
    const hasProvider = Object.keys(headers).some((k) => k.includes('provider name'))
    const hasActual = Object.keys(headers).some((k) => k.includes('actual duration'))
    if (hasProvider && hasActual) {
      const colMap: Record<string, number> = {}
      for (const [k, col] of Object.entries(headers)) {
        if (k.includes('provider name') && !k.includes('case')) colMap.providerName = col
        if (k === 'client' || (k.startsWith('client') && !k.includes('id'))) colMap.client = col
        if (k === 'dos' || k.startsWith('dos')) colMap.dos = col
        if (k === 'duration' && !k.includes('actual')) colMap.duration = col
        if (k.includes('actual duration')) colMap.actualDuration = col
        if (k.includes('practice procedure code') || k === 'procedure code') colMap.procedureCode = col
        if (k === 'location') colMap.location = col
        if (k.includes('case') && k.includes('role')) colMap.role = col
      }
      const statusCols = findStatusColumn(headers)
      if (statusCols.status) colMap.status = statusCols.status
      if (statusCols.cancellationReason) colMap.cancellationReason = statusCols.cancellationReason
      if (colMap.providerName && colMap.actualDuration) {
        return { rowNumber: r, colMap }
      }
    }
  }
  return null
}

function groupSessions(sessions: ParsedSessionRow[]): ProviderGroup[] {
  const map = new Map<string, ParsedSessionRow[]>()
  for (const s of sessions) {
    const key = s.providerName
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return Array.from(map.entries()).map(([providerName, rows]) => {
    const totalMinutes = rows.reduce((sum, r) => sum + r.actualMinutes, 0)
    return {
      providerName,
      role: rows[0]?.role ?? '',
      sessions: rows,
      totalSessions: rows.length,
      totalMinutes,
      totalHours: totalMinutes / 60,
    }
  })
}

export async function parseArtemisWorkbook(buffer: Buffer | ArrayBuffer): Promise<ArtemisParseResult> {
  const workbook = new ExcelJS.Workbook()
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer)

  let sheet =
    workbook.worksheets.find((w) =>
      w.name.toLowerCase().includes('session reconciliation report')
    ) ?? workbook.worksheets[0]

  if (!sheet) {
    throw new Error('No worksheet found in workbook')
  }

  const header = findHeaderRow(sheet)
  if (!header) {
    throw new Error('Could not find header row with Provider Name and Actual Duration')
  }

  const payrollSessions: ParsedSessionRow[] = []
  const excludedSessions: ParsedSessionRow[] = []
  const byRole: Record<string, number> = {}
  let minDate: Date | null = null
  let maxDate: Date | null = null
  let totalRows = 0
  let cancelledSessionCount = 0
  let skippedSessionCount = 0
  /** Artemis groups rows under a status header; blank cells inherit the group status. */
  let inheritedGroupStatus = ''

  for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const explicitStatus = header.colMap.status
      ? cellText(row.getCell(header.colMap.status)) || null
      : null
    const cancellationReason = header.colMap.cancellationReason
      ? cellText(row.getCell(header.colMap.cancellationReason)) || null
      : null

    if (explicitStatus && isSummaryStatus(explicitStatus)) {
      inheritedGroupStatus = ''
      skippedSessionCount++
      continue
    }

    if (explicitStatus) {
      inheritedGroupStatus = explicitStatus
    }

    const effectiveStatus = explicitStatus || inheritedGroupStatus || null

    if ((cancellationReason ?? '').trim().length > 0) {
      skippedSessionCount++
      if (effectiveStatus && /\bcancel/i.test(effectiveStatus)) cancelledSessionCount++
      continue
    }

    if (isNonBillableArtemisStatus(effectiveStatus)) {
      skippedSessionCount++
      if (categorizeSkippedStatus(effectiveStatus) === 'cancelled') cancelledSessionCount++
      continue
    }

    const providerName = header.colMap.providerName
      ? cellText(row.getCell(header.colMap.providerName))
      : ''

    const actualMinutes = header.colMap.actualDuration
      ? parseMinutes(row.getCell(header.colMap.actualDuration).value)
      : 0

    if (!providerName || actualMinutes <= 0) continue

    totalRows++
    const roleCol = header.colMap.role
    const role = roleCol ? cellText(row.getCell(roleCol)) : ''
    const roleKey = role || 'Unknown'
    byRole[roleKey] = (byRole[roleKey] ?? 0) + 1

    const dos = header.colMap.dos ? parseDos(row.getCell(header.colMap.dos).value) : null
    if (dos) {
      if (!minDate || dos < minDate) minDate = dos
      if (!maxDate || dos > maxDate) maxDate = dos
    }

    const session: ParsedSessionRow = {
      providerName,
      clientName: header.colMap.client ? cellText(row.getCell(header.colMap.client)) : '',
      dos: dos ?? new Date(0),
      scheduledMinutes: header.colMap.duration
        ? parseMinutes(row.getCell(header.colMap.duration).value)
        : 0,
      actualMinutes,
      procedureCode: header.colMap.procedureCode
        ? cellText(row.getCell(header.colMap.procedureCode)) || null
        : null,
      location: header.colMap.location ? cellText(row.getCell(header.colMap.location)) || null : null,
      role: roleKey,
      rawStatus: effectiveStatus,
    }

    if (isPayrollRole(roleKey)) {
      payrollSessions.push(session)
    } else {
      excludedSessions.push(session)
    }
  }

  const payrollGroups = groupSessions(payrollSessions)
  const excludedGroups = groupSessions(excludedSessions)

  return {
    payrollGroups,
    excludedGroups,
    stats: {
      totalRows,
      payrollSessionCount: payrollSessions.length,
      excludedSessionCount: excludedSessions.length,
      cancelledSessionCount,
      skippedSessionCount,
      payrollProviderCount: payrollGroups.length,
      excludedProviderCount: excludedGroups.length,
      byRole,
    },
    detectedDateRange: { min: minDate, max: maxDate },
  }
}

export { isPayrollRole, isExcludedRole }
