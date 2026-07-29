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
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }
const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

const NYC_BOROUGHS = [
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
    const clientKey = s.clientId
    let cb = b.clients.get(clientKey)
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
      b.clients.set(clientKey, cb)
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

  // Sort sessions within each client
  for (const b of boroughs.values()) {
    for (const cb of b.clients.values()) {
      cb.sessions.sort((a, b) => {
        const dayA = Object.entries(DAY_FULL).find(([, v]) => v === a.day)?.[0] ?? ''
        const dayB = Object.entries(DAY_FULL).find(([, v]) => v === b.day)?.[0] ?? ''
        const d =
          DAY_ORDER.indexOf(dayA as (typeof DAY_ORDER)[number]) -
          DAY_ORDER.indexOf(dayB as (typeof DAY_ORDER)[number])
        if (d !== 0) return d
        return a.start.localeCompare(b.start)
      })
    }
  }

  const sortedBoroughs = [...boroughs.values()].sort(
    (a, b) => boroughSortKey(a.name) - boroughSortKey(b.name) || a.name.localeCompare(b.name)
  )

  return sortedBoroughs.map((b) => ({
    name: b.name,
    totalHours: b.totalHours,
    sessionCount: b.sessionCount,
    clients: [...b.clients.values()].sort((a, c) => a.client.name.localeCompare(c.client.name)),
  }))
}

export async function buildScheduleWorkbook(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[]
): Promise<ExcelJS.Buffer> {
  const grouped = buildGrouped(slots, therapists, clients)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rise and Shine ABA'
  wb.created = new Date()

  const sheet = wb.addWorksheet('Schedule by Borough', {
    views: [{ state: 'frozen', ySplit: 5 }],
    properties: { defaultRowHeight: 18 },
  })

  sheet.columns = [
    { key: 'a', width: 14 },
    { key: 'b', width: 12 },
    { key: 'c', width: 12 },
    { key: 'd', width: 10 },
    { key: 'e', width: 22 },
    { key: 'f', width: 12 },
    { key: 'g', width: 14 },
    { key: 'h', width: 14 },
    { key: 'i', width: 16 },
    { key: 'j', width: 28 },
  ]

  const title = sheet.addRow(['Rise and Shine ABA — Weekly Schedule'])
  title.font = { bold: true, size: 16, color: { argb: TEAL } }
  sheet.mergeCells(1, 1, 1, 10)

  const subtitle = sheet.addRow([
    `Exported ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · Grouped by borough → client → sessions`,
  ])
  subtitle.font = { size: 10, italic: true, color: { argb: 'FF64748B' } }
  sheet.mergeCells(2, 1, 2, 10)

  const totalSessions = grouped.reduce((a, b) => a + b.sessionCount, 0)
  const totalHours = grouped.reduce((a, b) => a + b.totalHours, 0)
  const summary = sheet.addRow([
    `${grouped.length} boroughs · ${clients.filter((c) => c.active).length} clients · ${totalSessions} sessions · ${totalHours.toFixed(1)} hrs`,
  ])
  summary.font = { size: 11, bold: true }
  sheet.mergeCells(3, 1, 3, 10)

  sheet.addRow([])

  const header = sheet.addRow([
    'Day',
    'Start',
    'End',
    'Hours',
    'Therapist',
    'Role',
    'Status',
    'CPT',
    'Place of service',
    'Note',
  ])
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  header.height = 22

  for (const borough of grouped) {
    const bRow = sheet.addRow([
      borough.name.toUpperCase(),
      '',
      '',
      `${borough.totalHours.toFixed(1)} hrs`,
      `${borough.sessionCount} sessions`,
      `${borough.clients.length} clients`,
      '',
      '',
      '',
      '',
    ])
    sheet.mergeCells(bRow.number, 1, bRow.number, 3)
    bRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BOROUGH_FILL } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    })
    bRow.height = 24

    for (const cb of borough.clients) {
      const c = cb.client
      const meta = [
        c.code ? `Code ${c.code}` : null,
        c.bcba ? `BCBA: ${c.bcba}` : null,
        c.insurance ? c.insurance : null,
        c.authorizedHoursPerWeek != null ? `Auth ${c.authorizedHoursPerWeek} hrs/wk` : null,
      ]
        .filter(Boolean)
        .join(' · ')

      const cRow = sheet.addRow([
        `  ${c.name}`,
        '',
        '',
        `${cb.totalHours.toFixed(1)} hrs`,
        meta,
        '',
        '',
        '',
        '',
        '',
      ])
      sheet.mergeCells(cRow.number, 1, cRow.number, 3)
      sheet.mergeCells(cRow.number, 5, cRow.number, 10)
      cRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLIENT_FILL } }
        cell.font = { bold: true, color: { argb: 'FF134E4A' }, size: 11 }
      })

      let alt = false
      for (const s of cb.sessions) {
        const r = sheet.addRow([
          s.day,
          s.start,
          s.end,
          s.hours.toFixed(2),
          s.therapist,
          s.therapistRole,
          s.status,
          s.procedureCode,
          s.placeOfService,
          s.note,
        ])
        if (alt) {
          r.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } }
          })
        }
        alt = !alt
        r.getCell(4).alignment = { horizontal: 'right' }
      }
    }

    sheet.addRow([])
  }

  if (grouped.length === 0) {
    sheet.addRow(['No active sessions to export.'])
  }

  // Flat reference sheet for filtering/pivot
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

  return wb.xlsx.writeBuffer() as Promise<ExcelJS.Buffer>
}

export async function downloadScheduleExport(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[],
  filename = `schedule-by-borough-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
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
}

/** @deprecated Prefer downloadScheduleExport (.xlsx). Kept for callers that still want CSV. */
export function buildScheduleCsv(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[]
): string {
  const tMap = new Map(therapists.map((t) => [t.id, t]))
  const cMap = new Map(clients.map((c) => [c.id, c]))
  const headers = [
    'Borough',
    'Client',
    'Client code',
    'Day',
    'Start',
    'End',
    'Hours',
    'Therapist',
    'Therapist role',
    'Insurance',
    'BCBA',
    'Status',
    'Procedure code',
    'Place of service',
    'Note',
  ]
  const sorted = [...slots]
    .filter((s) => s.status !== 'CANCELLED')
    .sort((a, b) => {
      const ca = cMap.get(a.clientId)
      const cb = cMap.get(b.clientId)
      const ba = normalizeBorough(ca?.borough)
      const bb = normalizeBorough(cb?.borough)
      const bd = boroughSortKey(ba) - boroughSortKey(bb) || ba.localeCompare(bb)
      if (bd !== 0) return bd
      const cn = (ca?.name ?? '').localeCompare(cb?.name ?? '')
      if (cn !== 0) return cn
      const d = DAY_ORDER.indexOf(a.day as (typeof DAY_ORDER)[number]) - DAY_ORDER.indexOf(b.day as (typeof DAY_ORDER)[number])
      if (d !== 0) return d
      return a.startMin - b.startMin
    })

  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const rows = sorted.map((s) => {
    const t = tMap.get(s.therapistId)
    const c = cMap.get(s.clientId)
    return [
      normalizeBorough(c?.borough),
      c?.name ?? '',
      c?.code ?? '',
      DAY_FULL[s.day as Day] ?? s.day,
      minToLabel(s.startMin),
      minToLabel(s.endMin),
      hoursOf(s).toFixed(2),
      t?.name ?? '',
      t?.role ?? '',
      c?.insurance ?? '',
      c?.bcba ?? '',
      s.status,
      s.procedureCode,
      s.placeOfService,
      s.note ?? '',
    ].map(esc)
  })

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export function downloadScheduleCsv(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[],
  filename = `weekly-schedule-${new Date().toISOString().slice(0, 10)}.csv`
) {
  const csv = '\uFEFF' + buildScheduleCsv(slots, therapists, clients)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
