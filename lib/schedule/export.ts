/**
 * Schedule export — Excel workbook grouped by Borough → Client → sessions.
 */
import ExcelJS from 'exceljs'
import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from './types'
import { DAY_FULL, hoursOf, minToLabel, type Day } from './utils'

const TEAL = 'FF0E4D52'
const TEAL_SOFT = 'FFE6F0F1'
const BOROUGH_FILL = 'FF0D9488'
const CLIENT_FILL = 'FFF0FDF9'
const WARN_FILL = 'FFFEF3C7'
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }
const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

export const NYC_BOROUGHS = [
  'Bronx',
  'Brooklyn',
  'Manhattan',
  'Queens',
  'Staten Island',
] as const

export function normalizeBorough(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return 'Unassigned'
  const lower = s.toLowerCase()
  for (const b of NYC_BOROUGHS) {
    if (lower === b.toLowerCase()) return b
  }
  if (lower.includes('bronx')) return 'Bronx'
  if (lower.includes('brooklyn') || lower === 'bk') return 'Brooklyn'
  if (lower.includes('manhattan') || lower.includes('new york') || lower === 'nyc') return 'Manhattan'
  if (lower.includes('queens')) return 'Queens'
  if (lower.includes('staten')) return 'Staten Island'
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function boroughSortKey(name: string): number {
  const i = NYC_BOROUGHS.indexOf(name as (typeof NYC_BOROUGHS)[number])
  if (i >= 0) return i
  if (name === 'Unassigned') return 100
  return 50
}

type SessionRow = {
  day: string
  start: string
  end: string
  hours: number
  therapist: string
  therapistRole: string
  status: string
  procedureCode: string
  placeOfService: string
  note: string
}

function dayIndex(dayLabel: string): number {
  const code = Object.entries(DAY_FULL).find(([, v]) => v === dayLabel)?.[0] ?? ''
  const i = DAY_ORDER.indexOf(code as (typeof DAY_ORDER)[number])
  return i >= 0 ? i : 99
}

function buildGrouped(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[]
) {
  const tMap = new Map(therapists.map((t) => [t.id, t]))
  const cMap = new Map(clients.map((c) => [c.id, c]))

  type ClientBucket = {
    client: ScheduleClient
    sessions: SessionRow[]
    totalHours: number
  }
  type BoroughBucket = {
    name: string
    clients: Map<string, ClientBucket>
    totalHours: number
    sessionCount: number
  }

  const boroughs = new Map<string, BoroughBucket>()

  for (const s of slots) {
    if (s.status === 'CANCELLED') continue
    const c = cMap.get(s.clientId)
    const t = tMap.get(s.therapistId)
    const boroughName = normalizeBorough(c?.borough)
    let b = boroughs.get(boroughName)
    if (!b) {
      b = { name: boroughName, clients: new Map(), totalHours: 0, sessionCount: 0 }
      boroughs.set(boroughName, b)
    }
    let cb = b.clients.get(s.clientId)
    if (!cb) {
      cb = {
        client: c ?? {
          id: s.clientId,
          code: null,
          name: 'Unknown client',
          borough: null,
          insurance: null,
          bcba: null,
          authorizedHoursPerWeek: null,
          active: true,
        },
        sessions: [],
        totalHours: 0,
      }
      b.clients.set(s.clientId, cb)
    }
    const hrs = hoursOf(s)
    cb.sessions.push({
      day: DAY_FULL[s.day as Day] ?? s.day,
      start: minToLabel(s.startMin),
      end: minToLabel(s.endMin),
      hours: hrs,
      therapist: t?.name ?? '',
      therapistRole: t?.role ?? '',
      status: s.status,
      procedureCode: s.procedureCode,
      placeOfService: s.placeOfService,
      note: s.note ?? '',
    })
    cb.totalHours += hrs
    b.totalHours += hrs
    b.sessionCount += 1
  }

  for (const b of boroughs.values()) {
    for (const cb of b.clients.values()) {
      cb.sessions.sort((a, b) => {
        const d = dayIndex(a.day) - dayIndex(b.day)
        if (d !== 0) return d
        return a.start.localeCompare(b.start)
      })
    }
  }

  return [...boroughs.values()]
    .sort((a, b) => boroughSortKey(a.name) - boroughSortKey(b.name) || a.name.localeCompare(b.name))
    .map((b) => ({
      name: b.name,
      totalHours: b.totalHours,
      sessionCount: b.sessionCount,
      clients: [...b.clients.values()].sort((a, c) => a.client.name.localeCompare(c.client.name)),
    }))
}

export function countUnassignedBoroughClients(
  slots: ScheduleSlot[],
  clients: ScheduleClient[]
): { unassignedClients: number; totalActiveClientsWithSessions: number } {
  const cMap = new Map(clients.map((c) => [c.id, c]))
  const ids = new Set(
    slots.filter((s) => s.status !== 'CANCELLED').map((s) => s.clientId)
  )
  let unassigned = 0
  for (const id of ids) {
    if (normalizeBorough(cMap.get(id)?.borough) === 'Unassigned') unassigned++
  }
  return { unassignedClients: unassigned, totalActiveClientsWithSessions: ids.size }
}

export async function buildScheduleWorkbook(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[]
): Promise<ExcelJS.Buffer> {
  const grouped = buildGrouped(slots, therapists, clients)
  const { unassignedClients, totalActiveClientsWithSessions } = countUnassignedBoroughClients(
    slots,
    clients
  )
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rise and Shine ABA'
  wb.created = new Date()

  // ── Sheet 1: Borough → Client → sessions (Borough column on every row) ──
  const sheet = wb.addWorksheet('By borough', {
    views: [{ state: 'frozen', ySplit: 6 }],
    properties: { defaultRowHeight: 18 },
  })

  sheet.columns = [
    { key: 'borough', width: 14 },
    { key: 'client', width: 24 },
    { key: 'code', width: 10 },
    { key: 'day', width: 12 },
    { key: 'start', width: 10 },
    { key: 'end', width: 10 },
    { key: 'hours', width: 8 },
    { key: 'therapist', width: 22 },
    { key: 'role', width: 10 },
    { key: 'status', width: 12 },
    { key: 'cpt', width: 10 },
    { key: 'pos', width: 14 },
    { key: 'bcba', width: 16 },
    { key: 'insurance', width: 18 },
    { key: 'note', width: 24 },
  ]

  const title = sheet.addRow(['Rise and Shine ABA — Weekly Schedule'])
  title.font = { bold: true, size: 16, color: { argb: TEAL } }
  sheet.mergeCells(1, 1, 1, 15)

  const subtitle = sheet.addRow([
    `Exported ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · Grouped by borough → client → sessions`,
  ])
  subtitle.font = { size: 10, italic: true, color: { argb: 'FF64748B' } }
  sheet.mergeCells(2, 1, 2, 15)

  const totalSessions = grouped.reduce((a, b) => a + b.sessionCount, 0)
  const totalHours = grouped.reduce((a, b) => a + b.totalHours, 0)
  const assignedBoroughs = grouped.filter((b) => b.name !== 'Unassigned').length
  const summary = sheet.addRow([
    `${assignedBoroughs} assigned borough${assignedBoroughs === 1 ? '' : 's'} · ${grouped.length} group${grouped.length === 1 ? '' : 's'} · ${totalActiveClientsWithSessions} clients with sessions · ${totalSessions} sessions · ${totalHours.toFixed(1)} hrs`,
  ])
  summary.font = { size: 11, bold: true }
  sheet.mergeCells(3, 1, 3, 15)

  if (unassignedClients > 0) {
    const warn = sheet.addRow([
      `Warning: ${unassignedClients} of ${totalActiveClientsWithSessions} clients have no borough set. Assign boroughs on the schedule Client hours tab (Borough column), then export again.`,
    ])
    warn.font = { size: 10, bold: true, color: { argb: 'FF92400E' } }
    warn.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_FILL } }
    })
    sheet.mergeCells(4, 1, 4, 15)
  } else {
    sheet.addRow([])
  }

  sheet.addRow([])

  const header = sheet.addRow([
    'Borough',
    'Client',
    'Code',
    'Day',
    'Start',
    'End',
    'Hours',
    'Therapist',
    'Role',
    'Status',
    'CPT',
    'Place of service',
    'BCBA',
    'Insurance',
    'Note',
  ])
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle' }
  })
  header.height = 22

  for (const borough of grouped) {
    const bRow = sheet.addRow([
      `BOROUGH: ${borough.name.toUpperCase()}`,
      '',
      '',
      '',
      '',
      '',
      `${borough.totalHours.toFixed(1)} hrs`,
      `${borough.sessionCount} sessions`,
      `${borough.clients.length} clients`,
      '',
      '',
      '',
      '',
      '',
      '',
    ])
    sheet.mergeCells(bRow.number, 1, bRow.number, 6)
    bRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BOROUGH_FILL } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    })
    bRow.height = 24

    for (const cb of borough.clients) {
      const c = cb.client
      const cRow = sheet.addRow([
        borough.name,
        c.name,
        c.code ?? '',
        '',
        '',
        '',
        `${cb.totalHours.toFixed(1)} hrs`,
        '',
        '',
        '',
        '',
        '',
        c.bcba ?? '',
        c.insurance ?? '',
        c.authorizedHoursPerWeek != null ? `Auth ${c.authorizedHoursPerWeek} hrs/wk` : '',
      ])
      cRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLIENT_FILL } }
        cell.font = { bold: true, color: { argb: 'FF134E4A' }, size: 11 }
      })

      let alt = false
      for (const s of cb.sessions) {
        const r = sheet.addRow([
          borough.name,
          c.name,
          c.code ?? '',
          s.day,
          s.start,
          s.end,
          Number(s.hours.toFixed(2)),
          s.therapist,
          s.therapistRole,
          s.status,
          s.procedureCode,
          s.placeOfService,
          c.bcba ?? '',
          c.insurance ?? '',
          s.note,
        ])
        if (alt) {
          r.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } }
          })
        }
        alt = !alt
        r.getCell(7).alignment = { horizontal: 'right' }
      }
    }

    sheet.addRow([])
  }

  if (grouped.length === 0) {
    sheet.addRow(['No active sessions to export.'])
  }

  // ── Sheet 2: flat list (easy filter / pivot) ──
  const flat = wb.addWorksheet('All sessions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  flat.columns = [
    { header: 'Borough', key: 'borough', width: 14 },
    { header: 'Client', key: 'client', width: 24 },
    { header: 'Client code', key: 'code', width: 12 },
    { header: 'BCBA', key: 'bcba', width: 18 },
    { header: 'Insurance', key: 'insurance', width: 18 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Start', key: 'start', width: 10 },
    { header: 'End', key: 'end', width: 10 },
    { header: 'Hours', key: 'hours', width: 8 },
    { header: 'Therapist', key: 'therapist', width: 22 },
    { header: 'Role', key: 'role', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'CPT', key: 'cpt', width: 10 },
    { header: 'Place of service', key: 'pos', width: 14 },
    { header: 'Note', key: 'note', width: 24 },
  ]
  flat.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
  })

  for (const borough of grouped) {
    for (const cb of borough.clients) {
      for (const s of cb.sessions) {
        flat.addRow({
          borough: borough.name,
          client: cb.client.name,
          code: cb.client.code ?? '',
          bcba: cb.client.bcba ?? '',
          insurance: cb.client.insurance ?? '',
          day: s.day,
          start: s.start,
          end: s.end,
          hours: Number(s.hours.toFixed(2)),
          therapist: s.therapist,
          role: s.therapistRole,
          status: s.status,
          cpt: s.procedureCode,
          pos: s.placeOfService,
          note: s.note,
        })
      }
    }
  }

  // ── Sheet 3: client roster with borough assignment status ──
  const roster = wb.addWorksheet('Client boroughs', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  roster.columns = [
    { header: 'Client', key: 'name', width: 28 },
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Borough', key: 'borough', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'BCBA', key: 'bcba', width: 18 },
    { header: 'Insurance', key: 'insurance', width: 18 },
    { header: 'Scheduled hrs', key: 'hours', width: 12 },
  ]
  roster.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
  })

  const hoursByClient = new Map<string, number>()
  for (const s of slots) {
    if (s.status === 'CANCELLED') continue
    hoursByClient.set(s.clientId, (hoursByClient.get(s.clientId) ?? 0) + hoursOf(s))
  }

  for (const c of [...clients].filter((x) => x.active).sort((a, b) => a.name.localeCompare(b.name))) {
    const borough = normalizeBorough(c.borough)
    const row = roster.addRow({
      name: c.name,
      code: c.code ?? '',
      borough: c.borough?.trim() || '',
      status: borough === 'Unassigned' ? 'NEEDS BOROUGH' : 'OK',
      bcba: c.bcba ?? '',
      insurance: c.insurance ?? '',
      hours: Number((hoursByClient.get(c.id) ?? 0).toFixed(2)),
    })
    if (borough === 'Unassigned') {
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_FILL } }
      row.getCell(4).font = { bold: true, color: { argb: 'FF92400E' } }
    }
  }

  return wb.xlsx.writeBuffer() as Promise<ExcelJS.Buffer>
}

export async function downloadScheduleExport(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[],
  filename = `schedule-by-borough-${new Date().toISOString().slice(0, 10)}.xlsx`
): Promise<{ unassignedClients: number; totalActiveClientsWithSessions: number }> {
  const counts = countUnassignedBoroughClients(slots, clients)
  const buf = await buildScheduleWorkbook(slots, therapists, clients)
  const blob = new Blob([buf as unknown as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return counts
}
