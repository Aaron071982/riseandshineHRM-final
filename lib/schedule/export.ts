import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from './types'
import { DAY_FULL, hoursOf, minToLabel, type Day } from './utils'

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildScheduleCsv(
  slots: ScheduleSlot[],
  therapists: ScheduleTherapist[],
  clients: ScheduleClient[]
): string {
  const tMap = new Map(therapists.map((t) => [t.id, t]))
  const cMap = new Map(clients.map((c) => [c.id, c]))

  const sorted = [...slots].sort((a, b) => {
    const dayOrder = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    const d = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
    if (d !== 0) return d
    if (a.startMin !== b.startMin) return a.startMin - b.startMin
    return (tMap.get(a.therapistId)?.name ?? '').localeCompare(tMap.get(b.therapistId)?.name ?? '')
  })

  const headers = [
    'Day',
    'Start',
    'End',
    'Hours',
    'Therapist',
    'Therapist role',
    'Client',
    'Client code',
    'Insurance',
    'BCBA',
    'Status',
    'Procedure code',
    'Place of service',
    'Note',
  ]

  const rows = sorted.map((s) => {
    const t = tMap.get(s.therapistId)
    const c = cMap.get(s.clientId)
    return [
      DAY_FULL[s.day as Day] ?? s.day,
      minToLabel(s.startMin),
      minToLabel(s.endMin),
      hoursOf(s).toFixed(2),
      t?.name ?? '',
      t?.role ?? '',
      c?.name ?? '',
      c?.code ?? '',
      c?.insurance ?? '',
      c?.bcba ?? '',
      s.status,
      s.procedureCode,
      s.placeOfService,
      s.note ?? '',
    ].map(csvEscape)
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
