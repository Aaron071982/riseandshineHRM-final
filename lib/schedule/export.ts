/**
 * Schedule export — Excel workbook grouped by RBT borough → RBT → sessions.
 */
import ExcelJS from 'exceljs'
import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from './types'
import { DAY_FULL, hoursOf, minToLabel, type Day } from './utils'
import {
  NYC_BOROUGHS,
  boroughSortKey,
  normalizeBorough,
} from './borough'

export { NYC_BOROUGHS, normalizeBorough } from './borough'

const TEAL = 'FF0E4D52'
const TEAL_SOFT = 'FFE6F0F1'
const BOROUGH_FILL = 'FF0D9488'
const RBT_FILL = 'FFF0FDF9'
const WARN_FILL = 'FFFEF3C7'
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }
const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

type SessionRow = {
  day: string
  start: string
  end: string
  hours: number
  client: string
  clientCode: string
  clientBcba: string
  clientInsurance: string
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

  type RbtBucket = {
    therapist: ScheduleTherapist
    sessions: SessionRow[]
    totalHours: number
  }
  type BoroughBucket = {
    name: string
    rbts: Map<string, RbtBucket>
    totalHours: number
    sessionCount: number
  }

  const boroughs = new Map<string, BoroughBucket>()

  for (const s of slots) {
    if (s.status === 'CANCELLED') continue
    const t = tMap.get(s.therapistId)
    const c = cMap.get(s.clientId)
    const boroughName = normalizeBorough(t?.borough)
    let b = boroughs.get(boroughName)
    if (!b) {
      b = { name: boroughName, rbts: new Map(), totalHours: 0, sessionCount: 0 }
      boroughs.set(boroughName, b)
    }
    let rb = b.rbts.get(s.therapistId)
    if (!rb) {
      rb = {
        therapist: t ?? {
          id: s.therapistId,
          name: 'Unknown therapist',
          email: null,
          role: 'RBT',
          borough: null,
          colorKey: null,
          active: true,
        },
        sessions: [],
        totalHours: 0,
      }
      b.rbts.set(s.therapistId, rb)
    }
    const hrs = hoursOf(s)
    rb.sessions.push({
      day: DAY_FULL[s.day as Day] ?? s.day,
      start: minToLabel(s.startMin),
      end: minToLabel(s.endMin),
      hours: hrs,
      client: c?.name ?? 'Unknown client',
      clientCode: c?.code ?? '',
      clientBcba: c?.bcba ?? '',
      clientInsurance: c?.insurance ?? '',
      status: s.status,
      procedureCode: s.procedureCode,
      placeOfService: s.placeOfService,
      note: s.note ?? '',
    })
    rb.totalHours += hrs
    b.totalHours += hrs
    b.sessionCount += 1
  }

  for (const b of boroughs.values()) {
    for (const rb of b.rbts.values()) {
      rb.sessions.sort((a, c) => {
        const d = dayIndex(a.day) - dayIndex(c.day)
        if (d !== 0) return d
        if (a.start !== c.start) return a.start.localeCompare(c.start)
        return a.client.localeCompare(c.client)
      })
    }
  }

  return [...boroughs.values()]
    .sort((a, b) => boroughSortKey(a.name) - boroughSortKey(b.name) || a.name.localeCompare(b.name))
    .map((b) => ({
      name: b.name,
      totalHours: b.totalHours,
      sessionCount: b.sessionCount,
      rbts: [...b.rbts.values()].sort((a, c) => a.therapist.name.localeCompare(c.therapist.name)),
    }))
}

export function countUnassignedBoroughRbts(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[]
): { unassignedRbts: number; totalRbtsWithSessions: number } {
  const tMap = new Map(therapists.map((t) => [t.id, t]))
  const ids = new Set(slots.filter((s) => s.status !== 'CANCELLED').map((s) => s.therapistId))
  let unassigned = 0
  for (const id of ids) {
    if (normalizeBorough(tMap.get(id)?.borough) === 'Unassigned') unassigned++
  }
  return { unassignedRbts: unassigned, totalRbtsWithSessions: ids.size }
}

export async function buildScheduleWorkbook(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[]
): Promise<ExcelJS.Buffer> {
  const grouped = buildGrouped(slots, therapists, clients)
  const { unassignedRbts, totalRbtsWithSessions } = countUnassignedBoroughRbts(slots, therapists)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rise and Shine ABA'
  wb.created = new Date()

  const sheet = wb.addWorksheet('By RBT borough', {
    views: [{ state: 'frozen', ySplit: 6 }],
    properties: { defaultRowHeight: 18 },
  })

  sheet.columns = [
    { key: 'borough', width: 14 },
    { key: 'rbt', width: 22 },
    { key: 'role', width: 10 },
    { key: 'client', width: 24 },
    { key: 'code', width: 10 },
    { key: 'day', width: 12 },
    { key: 'start', width: 10 },
    { key: 'end', width: 10 },
    { key: 'hours', width: 8 },
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
    `Exported ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · Grouped by RBT borough → RBT → sessions`,
  ])
  subtitle.font = { size: 10, italic: true, color: { argb: 'FF64748B' } }
  sheet.mergeCells(2, 1, 2, 15)

  const totalSessions = grouped.reduce((a, b) => a + b.sessionCount, 0)
  const totalHours = grouped.reduce((a, b) => a + b.totalHours, 0)
  const assignedBoroughs = grouped.filter((b) => b.name !== 'Unassigned').length
  const summary = sheet.addRow([
    `${assignedBoroughs} assigned borough${assignedBoroughs === 1 ? '' : 's'} · ${totalRbtsWithSessions} RBTs with sessions · ${totalSessions} sessions · ${totalHours.toFixed(1)} hrs`,
  ])
  summary.font = { size: 11, bold: true }
  sheet.mergeCells(3, 1, 3, 15)

  if (unassignedRbts > 0) {
    const warn = sheet.addRow([
      `Warning: ${unassignedRbts} of ${totalRbtsWithSessions} RBTs have no borough. Set borough in Manage → Therapists (or match RBT profile city/zip), then export again.`,
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
    'RBT',
    'Role',
    'Client',
    'Code',
    'Day',
    'Start',
    'End',
    'Hours',
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
      '',
      '',
      `${borough.totalHours.toFixed(1)} hrs`,
      `${borough.sessionCount} sessions`,
      `${borough.rbts.length} RBTs`,
      '',
      '',
      '',
      '',
    ])
    sheet.mergeCells(bRow.number, 1, bRow.number, 8)
    bRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BOROUGH_FILL } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    })
    bRow.height = 24

    for (const rb of borough.rbts) {
      const t = rb.therapist
      const rRow = sheet.addRow([
        borough.name,
        t.name,
        t.role,
        '',
        '',
        '',
        '',
        '',
        `${rb.totalHours.toFixed(1)} hrs`,
        `${rb.sessions.length} sessions`,
        '',
        '',
        '',
        '',
        '',
      ])
      rRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RBT_FILL } }
        cell.font = { bold: true, color: { argb: 'FF134E4A' }, size: 11 }
      })

      let alt = false
      for (const s of rb.sessions) {
        const row = sheet.addRow([
          borough.name,
          t.name,
          t.role,
          s.client,
          s.clientCode,
          s.day,
          s.start,
          s.end,
          Number(s.hours.toFixed(2)),
          s.status,
          s.procedureCode,
          s.placeOfService,
          s.clientBcba,
          s.clientInsurance,
          s.note,
        ])
        if (alt) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } }
          })
        }
        alt = !alt
        row.getCell(9).alignment = { horizontal: 'right' }
      }
    }

    sheet.addRow([])
  }

  if (grouped.length === 0) {
    sheet.addRow(['No active sessions to export.'])
  }

  // Flat sheet
  const flat = wb.addWorksheet('All sessions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  flat.columns = [
    { header: 'Borough', key: 'borough', width: 14 },
    { header: 'RBT', key: 'rbt', width: 22 },
    { header: 'Role', key: 'role', width: 10 },
    { header: 'Client', key: 'client', width: 24 },
    { header: 'Client code', key: 'code', width: 12 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Start', key: 'start', width: 10 },
    { header: 'End', key: 'end', width: 10 },
    { header: 'Hours', key: 'hours', width: 8 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'CPT', key: 'cpt', width: 10 },
    { header: 'Place of service', key: 'pos', width: 14 },
    { header: 'BCBA', key: 'bcba', width: 16 },
    { header: 'Insurance', key: 'insurance', width: 18 },
    { header: 'Note', key: 'note', width: 24 },
  ]
  flat.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
  })

  for (const borough of grouped) {
    for (const rb of borough.rbts) {
      for (const s of rb.sessions) {
        flat.addRow({
          borough: borough.name,
          rbt: rb.therapist.name,
          role: rb.therapist.role,
          client: s.client,
          code: s.clientCode,
          day: s.day,
          start: s.start,
          end: s.end,
          hours: Number(s.hours.toFixed(2)),
          status: s.status,
          cpt: s.procedureCode,
          pos: s.placeOfService,
          bcba: s.clientBcba,
          insurance: s.clientInsurance,
          note: s.note,
        })
      }
    }
  }

  // RBT borough roster
  const roster = wb.addWorksheet('RBT boroughs', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  roster.columns = [
    { header: 'RBT', key: 'name', width: 24 },
    { header: 'Role', key: 'role', width: 10 },
    { header: 'Borough', key: 'borough', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Scheduled hrs', key: 'hours', width: 12 },
  ]
  roster.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    cell.font = HEADER_FONT
  })

  const hoursByTherapist = new Map<string, number>()
  for (const s of slots) {
    if (s.status === 'CANCELLED') continue
    hoursByTherapist.set(s.therapistId, (hoursByTherapist.get(s.therapistId) ?? 0) + hoursOf(s))
  }

  for (const t of [...therapists].filter((x) => x.active).sort((a, b) => a.name.localeCompare(b.name))) {
    const borough = normalizeBorough(t.borough)
    const row = roster.addRow({
      name: t.name,
      role: t.role,
      borough: t.borough?.trim() || '',
      status: borough === 'Unassigned' ? 'NEEDS BOROUGH' : 'OK',
      email: t.email ?? '',
      hours: Number((hoursByTherapist.get(t.id) ?? 0).toFixed(2)),
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
  filename = `schedule-by-rbt-borough-${new Date().toISOString().slice(0, 10)}.xlsx`
): Promise<{ unassignedRbts: number; totalRbtsWithSessions: number }> {
  const counts = countUnassignedBoroughRbts(slots, therapists)
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
