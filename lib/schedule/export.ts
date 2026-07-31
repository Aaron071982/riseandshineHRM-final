/**
 * Schedule export — Excel workbook grouped by client borough → client → sessions.
 */
import ExcelJS from 'exceljs'
import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from './types'
import { DAY_FULL, hoursOf, minToLabel, type Day } from './utils'
import {
  boroughSortKey,
  ensureAllBoroughSections,
  normalizeBorough,
} from './borough'

export { NYC_BOROUGHS, normalizeBorough } from './borough'

const TEAL = 'FF0E4D52'
const TEAL_SOFT = 'FFE6F0F1'
const BOROUGH_FILL = 'FF0D9488'
const CLIENT_FILL = 'FFF0FDF9'
const WARN_FILL = 'FFFEF3C7'
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }
const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

type SessionRow = {
  day: string
  start: string
  end: string
  hours: number
  rbt: string
  role: string
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
    const t = tMap.get(s.therapistId)
    const c = cMap.get(s.clientId)
    const boroughName = normalizeBorough(c?.borough)
    let b = boroughs.get(boroughName)
    if (!b) {
      b = { name: boroughName, clients: new Map(), totalHours: 0, sessionCount: 0 }
      boroughs.set(boroughName, b)
    }
    const clientId = s.clientId
    let cb = b.clients.get(clientId)
    if (!cb) {
      cb = {
        client: c ?? {
          id: clientId,
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
      b.clients.set(clientId, cb)
    }
    const hrs = hoursOf(s)
    cb.sessions.push({
      day: DAY_FULL[s.day as Day] ?? s.day,
      start: minToLabel(s.startMin),
      end: minToLabel(s.endMin),
      hours: hrs,
      rbt: t?.name ?? 'Unknown therapist',
      role: t?.role ?? 'RBT',
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
      cb.sessions.sort((a, c) => {
        const d = dayIndex(a.day) - dayIndex(c.day)
        if (d !== 0) return d
        if (a.start !== c.start) return a.start.localeCompare(c.start)
        return a.rbt.localeCompare(c.rbt)
      })
    }
  }

  const mapped = [...boroughs.values()]
    .sort((a, b) => boroughSortKey(a.name) - boroughSortKey(b.name) || a.name.localeCompare(b.name))
    .map((b) => ({
      name: b.name,
      totalHours: b.totalHours,
      sessionCount: b.sessionCount,
      clients: [...b.clients.values()].sort((a, c) => a.client.name.localeCompare(c.client.name)),
    }))

  return ensureAllBoroughSections(mapped, (name) => ({
    name,
    totalHours: 0,
    sessionCount: 0,
    clients: [],
  }))
}

/** Clients with sessions who have no borough set. */
export function countUnassignedBoroughClients(
  slots: ScheduleSlot[],
  clients: ScheduleClient[]
): { unassignedClients: number; totalClientsWithSessions: number } {
  const cMap = new Map(clients.map((c) => [c.id, c]))
  const ids = new Set(slots.filter((s) => s.status !== 'CANCELLED').map((s) => s.clientId))
  let unassigned = 0
  for (const id of ids) {
    if (normalizeBorough(cMap.get(id)?.borough) === 'Unassigned') unassigned++
  }
  return { unassignedClients: unassigned, totalClientsWithSessions: ids.size }
}

/** @deprecated use countUnassignedBoroughClients */
export function countUnassignedBoroughRbts(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients?: ScheduleClient[]
): { unassignedRbts: number; totalRbtsWithSessions: number; unassignedClients?: number; totalClientsWithSessions?: number } {
  if (clients) {
    const c = countUnassignedBoroughClients(slots, clients)
    return {
      unassignedRbts: c.unassignedClients,
      totalRbtsWithSessions: c.totalClientsWithSessions,
      unassignedClients: c.unassignedClients,
      totalClientsWithSessions: c.totalClientsWithSessions,
    }
  }
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
  const { unassignedClients, totalClientsWithSessions } = countUnassignedBoroughClients(
    slots,
    clients
  )
  const rbtIds = new Set(slots.filter((s) => s.status !== 'CANCELLED').map((s) => s.therapistId))
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rise and Shine ABA'
  wb.created = new Date()

  const sheet = wb.addWorksheet('By client borough', {
    views: [{ state: 'frozen', ySplit: 6 }],
    properties: { defaultRowHeight: 18 },
  })

  sheet.columns = [
    { key: 'borough', width: 14 },
    { key: 'client', width: 24 },
    { key: 'code', width: 10 },
    { key: 'rbt', width: 22 },
    { key: 'role', width: 10 },
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
    `Exported ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · Grouped by client borough → client → sessions`,
  ])
  subtitle.font = { size: 10, italic: true, color: { argb: 'FF64748B' } }
  sheet.mergeCells(2, 1, 2, 15)

  const totalSessions = grouped.reduce((a, b) => a + b.sessionCount, 0)
  const totalHours = grouped.reduce((a, b) => a + b.totalHours, 0)
  const activeBoroughs = grouped.filter(
    (b) => b.name !== 'Unassigned' && b.sessionCount > 0
  ).length
  const summary = sheet.addRow([
    `${activeBoroughs} borough${activeBoroughs === 1 ? '' : 's'} with sessions · ${rbtIds.size} RBTs · ${totalClientsWithSessions} clients · ${totalSessions} sessions · ${totalHours.toFixed(1)} hrs`,
  ])
  summary.font = { size: 11, bold: true }
  sheet.mergeCells(3, 1, 3, 15)

  if (unassignedClients > 0) {
    const warn = sheet.addRow([
      `Warning: ${unassignedClients} of ${totalClientsWithSessions} clients have no borough. Set borough in Manage → Clients (or Import Artemis client boroughs), then export again.`,
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
    'RBT',
    'Role',
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
      `${borough.clients.length} clients`,
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

    for (const cb of borough.clients) {
      const c = cb.client
      const cRow = sheet.addRow([
        borough.name,
        c.name,
        c.code ?? '',
        '',
        '',
        '',
        '',
        '',
        `${cb.totalHours.toFixed(1)} hrs`,
        `${cb.sessions.length} sessions`,
        '',
        '',
        c.bcba ?? '',
        c.insurance ?? '',
        '',
      ])
      cRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLIENT_FILL } }
        cell.font = { bold: true, color: { argb: 'FF134E4A' }, size: 11 }
      })

      let alt = false
      for (const s of cb.sessions) {
        const row = sheet.addRow([
          borough.name,
          c.name,
          c.code ?? '',
          s.rbt,
          s.role,
          s.day,
          s.start,
          s.end,
          Number(s.hours.toFixed(2)),
          s.status,
          s.procedureCode,
          s.placeOfService,
          c.bcba ?? '',
          c.insurance ?? '',
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
    { header: 'Client', key: 'client', width: 24 },
    { header: 'Client code', key: 'code', width: 12 },
    { header: 'RBT', key: 'rbt', width: 22 },
    { header: 'Role', key: 'role', width: 10 },
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
    for (const cb of borough.clients) {
      for (const s of cb.sessions) {
        flat.addRow({
          borough: borough.name,
          client: cb.client.name,
          code: cb.client.code ?? '',
          rbt: s.rbt,
          role: s.role,
          day: s.day,
          start: s.start,
          end: s.end,
          hours: Number(s.hours.toFixed(2)),
          status: s.status,
          cpt: s.procedureCode,
          pos: s.placeOfService,
          bcba: cb.client.bcba ?? '',
          insurance: cb.client.insurance ?? '',
          note: s.note,
        })
      }
    }
  }

  // Client borough roster
  const roster = wb.addWorksheet('Client boroughs', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  roster.columns = [
    { header: 'Client', key: 'name', width: 28 },
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Borough', key: 'borough', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'BCBA', key: 'bcba', width: 16 },
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
  filename = `schedule-by-client-borough-${new Date().toISOString().slice(0, 10)}.xlsx`
): Promise<{
  unassignedRbts: number
  totalRbtsWithSessions: number
  unassignedClients: number
  totalClientsWithSessions: number
}> {
  const clientCounts = countUnassignedBoroughClients(slots, clients)
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
  return {
    unassignedRbts: clientCounts.unassignedClients,
    totalRbtsWithSessions: clientCounts.totalClientsWithSessions,
    unassignedClients: clientCounts.unassignedClients,
    totalClientsWithSessions: clientCounts.totalClientsWithSessions,
  }
}
