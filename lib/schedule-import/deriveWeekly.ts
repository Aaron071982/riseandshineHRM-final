/**
 * Derive recurring weekly schedule slots from Artemis session reconciliation.
 * Uses SCHEDULED appointment times only; RBT/BT roles only.
 */
import ExcelJS from 'exceljs'
import { parseArtemisDateTime } from '@/lib/billing/scheduleClamp'
import { formatMinutes } from '@/lib/rbt-schedule/utils'

const PAYROLL_ROLES = new Set(['rbt', 'bt'])
/** Near-duplicate window: start and end within this many minutes → same cluster. */
const NEAR_MINUTES = 30

export type DerivedSlot = {
  clientName: string
  dayOfWeek: number // 0=Sun … 6=Sat
  startTime: string // HH:MM
  endTime: string
  startMin: number
  endMin: number
  occurrenceCount: number
}

export type DerivedProviderSchedule = {
  providerName: string
  role: string
  slots: DerivedSlot[]
}

export type ScheduleDeriveResult = {
  providers: DerivedProviderSchedule[]
  clientNames: string[]
  detectedDateRange: { min: Date | null; max: Date | null }
  stats: {
    sessionRows: number
    providerCount: number
    slotCount: number
  }
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

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value
  if (v != null && typeof v === 'object' && 'result' in v) return (v as { result: unknown }).result
  if (v != null && typeof v === 'object' && 'text' in v) return (v as { text: unknown }).text
  return v
}

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[↑↓]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeClient(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function findHeaderRow(
  sheet: ExcelJS.Worksheet
): { rowNumber: number; colMap: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(sheet.rowCount, 50); r++) {
    const row = sheet.getRow(r)
    const headers: Record<string, number> = {}
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = normalizeHeaderKey(cellText(cell))
      if (key) headers[key] = col
    })
    const hasProvider = Object.keys(headers).some((k) => k.includes('provider name'))
    const hasAppt = Object.keys(headers).some((k) => k.includes('appointment start'))
    if (!hasProvider || !hasAppt) continue

    const colMap: Record<string, number> = {}
    for (const [k, col] of Object.entries(headers)) {
      if (k.includes('provider name') && !k.includes('case')) colMap.providerName = col
      if (k === 'client' || (k.startsWith('client') && !k.includes('id'))) colMap.client = col
      if (k.includes('appointment start')) colMap.appointmentStart = col
      if (k.includes('appointment end')) colMap.appointmentEnd = col
      if (k.includes('case') && k.includes('role')) colMap.role = col
      if (k === 'status' || (k.startsWith('status') && !k.includes('claim'))) {
        if (!colMap.status || k === 'status') colMap.status = col
      }
    }
    if (colMap.providerName && colMap.appointmentStart && colMap.appointmentEnd) {
      return { rowNumber: r, colMap }
    }
  }
  return null
}

type RawOcc = {
  providerName: string
  role: string
  clientName: string
  dayOfWeek: number
  startMin: number
  endMin: number
}

function pickModePattern(
  occurrences: { startMin: number; endMin: number }[],
  siblingPatterns: Map<string, number>
): { startMin: number; endMin: number } {
  // Cluster near-duplicates
  const clusters: { startMin: number; endMin: number }[][] = []
  for (const occ of occurrences) {
    let placed = false
    for (const cluster of clusters) {
      const rep = cluster[0]
      if (
        Math.abs(rep.startMin - occ.startMin) <= NEAR_MINUTES &&
        Math.abs(rep.endMin - occ.endMin) <= NEAR_MINUTES
      ) {
        cluster.push(occ)
        placed = true
        break
      }
    }
    if (!placed) clusters.push([occ])
  }

  // Largest cluster wins (collapse near-duplicates into one)
  clusters.sort((a, b) => b.length - a.length)
  const cluster = clusters[0]

  // Mode of exact (start,end) within cluster
  const counts = new Map<string, { startMin: number; endMin: number; n: number }>()
  for (const o of cluster) {
    const key = `${o.startMin}-${o.endMin}`
    const cur = counts.get(key)
    if (cur) cur.n++
    else counts.set(key, { startMin: o.startMin, endMin: o.endMin, n: 1 })
  }

  const ranked = [...counts.values()].sort((a, b) => {
    if (b.n !== a.n) return b.n - a.n
    // Tie-break: prefer pattern seen more often for this client on other days
    const sa = siblingPatterns.get(`${a.startMin}-${a.endMin}`) ?? 0
    const sb = siblingPatterns.get(`${b.startMin}-${b.endMin}`) ?? 0
    if (sb !== sa) return sb - sa
    // Then prefer shorter duration (scheduled window, not overtime)
    return a.endMin - a.startMin - (b.endMin - b.startMin)
  })

  return { startMin: ranked[0].startMin, endMin: ranked[0].endMin }
}

function deriveSlotsForProvider(rows: RawOcc[]): DerivedSlot[] {
  // Sibling pattern counts across all days for same client (for tie-break)
  const byClientDay = new Map<string, RawOcc[]>()
  for (const r of rows) {
    const key = `${normalizeClient(r.clientName).toLowerCase()}|${r.dayOfWeek}`
    if (!byClientDay.has(key)) byClientDay.set(key, [])
    byClientDay.get(key)!.push(r)
  }

  const siblingByClient = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const ck = normalizeClient(r.clientName).toLowerCase()
    if (!siblingByClient.has(ck)) siblingByClient.set(ck, new Map())
    const m = siblingByClient.get(ck)!
    const pk = `${r.startMin}-${r.endMin}`
    m.set(pk, (m.get(pk) ?? 0) + 1)
  }

  const slots: DerivedSlot[] = []
  for (const [, group] of byClientDay) {
    const clientName = normalizeClient(group[0].clientName)
    const dayOfWeek = group[0].dayOfWeek
    const siblings = siblingByClient.get(clientName.toLowerCase()) ?? new Map()
    const mode = pickModePattern(
      group.map((g) => ({ startMin: g.startMin, endMin: g.endMin })),
      siblings
    )
    slots.push({
      clientName,
      dayOfWeek,
      startMin: mode.startMin,
      endMin: mode.endMin,
      startTime: formatMinutes(mode.startMin),
      endTime: formatMinutes(mode.endMin),
      occurrenceCount: group.length,
    })
  }

  slots.sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek ||
      a.startMin - b.startMin ||
      a.clientName.localeCompare(b.clientName)
  )
  return slots
}

export async function deriveWeeklySchedulesFromArtemis(
  buffer: Buffer | ArrayBuffer
): Promise<ScheduleDeriveResult> {
  const workbook = new ExcelJS.Workbook()
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer)

  const sheet =
    workbook.worksheets.find((w) =>
      w.name.toLowerCase().includes('session reconciliation report')
    ) ?? workbook.worksheets[0]

  if (!sheet) throw new Error('No worksheet found in workbook')

  const header = findHeaderRow(sheet)
  if (!header) {
    throw new Error('Could not find header row with Provider Name and Appointment Start Time')
  }

  const raw: RawOcc[] = []
  let minDate: Date | null = null
  let maxDate: Date | null = null
  let inheritedProvider = ''
  let inheritedRole = ''

  for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const providerExplicit = header.colMap.providerName
      ? cellText(row.getCell(header.colMap.providerName))
      : ''
    const roleExplicit = header.colMap.role ? cellText(row.getCell(header.colMap.role)) : ''

    if (providerExplicit) inheritedProvider = providerExplicit
    if (roleExplicit) inheritedRole = roleExplicit

    const providerName = providerExplicit || inheritedProvider
    const role = roleExplicit || inheritedRole
    if (!providerName) continue
    if (!PAYROLL_ROLES.has(role.trim().toLowerCase())) continue

    const clientName = header.colMap.client ? cellText(row.getCell(header.colMap.client)) : ''
    if (!clientName) continue

    const start = parseArtemisDateTime(cellValue(row.getCell(header.colMap.appointmentStart)))
    const end = header.colMap.appointmentEnd
      ? parseArtemisDateTime(cellValue(row.getCell(header.colMap.appointmentEnd)))
      : null
    if (!start || !end || end.getTime() <= start.getTime()) continue

    const dayOfWeek = start.getDay()
    // Artemis wall-clock is stored as UTC components — do not use local getters
    const startMin = start.getUTCHours() * 60 + start.getUTCMinutes()
    const endMin = end.getUTCHours() * 60 + end.getUTCMinutes()
    if (endMin <= startMin) continue

    raw.push({
      providerName: providerName.trim(),
      role: role.trim() || 'RBT',
      clientName,
      dayOfWeek,
      startMin,
      endMin,
    })

    const dayOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    if (!minDate || dayOnly < minDate) minDate = dayOnly
    if (!maxDate || dayOnly > maxDate) maxDate = dayOnly
  }

  const byProvider = new Map<string, RawOcc[]>()
  for (const row of raw) {
    if (!byProvider.has(row.providerName)) byProvider.set(row.providerName, [])
    byProvider.get(row.providerName)!.push(row)
  }

  const providers: DerivedProviderSchedule[] = []
  const clientSet = new Set<string>()

  for (const [providerName, rows] of [...byProvider.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const slots = deriveSlotsForProvider(rows)
    for (const s of slots) clientSet.add(s.clientName)
    providers.push({
      providerName,
      role: rows[0]?.role ?? 'RBT',
      slots,
    })
  }

  const slotCount = providers.reduce((n, p) => n + p.slots.length, 0)

  return {
    providers,
    clientNames: [...clientSet].sort((a, b) => a.localeCompare(b)),
    detectedDateRange: { min: minDate, max: maxDate },
    stats: {
      sessionRows: raw.length,
      providerCount: providers.length,
      slotCount,
    },
  }
}
