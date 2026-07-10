export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
export type Day = (typeof DAYS)[number]
export const DAY_LABEL: Record<Day, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
}

export const DAY_FULL: Record<Day, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
}

const pad = (n: number) => String(n).padStart(2, '0')
export const minToInput = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
export const inputToMin = (v: string) => {
  const [h, mm] = v.split(':').map(Number)
  return h * 60 + mm
}
export const minToLabel = (m: number) => {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 || 12
  return `${hh}:${pad(mm)} ${ap}`
}
export const minToShort = (m: number) => {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const ap = h >= 12 ? 'p' : 'a'
  const hh = h % 12 || 12
  return mm ? `${hh}:${pad(mm)}${ap}` : `${hh}${ap}`
}
export const rangeShort = (s: number, e: number) => `${minToShort(s)}–${minToShort(e)}`
export const hoursOf = (s: { startMin: number; endMin: number }) => (s.endMin - s.startMin) / 60
export const fmtH = (x: number) => {
  const r = Math.round(x * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export const THERAPIST_PALETTE = [
  { bar: '#0E8A8A', soft: '#E2F2F2' },
  { bar: '#5B5BD6', soft: '#E9E9FB' },
  { bar: '#D6486B', soft: '#FBE7ED' },
  { bar: '#C8832A', soft: '#FBEFD8' },
  { bar: '#1E9E6A', soft: '#E0F4EC' },
  { bar: '#8B4FD1', soft: '#F0E7FB' },
  { bar: '#2E8FD6', soft: '#E2F0FB' },
  { bar: '#DB6B34', soft: '#FBE9DE' },
  { bar: '#1596A6', soft: '#E0F3F5' },
  { bar: '#C85BA8', soft: '#F8E7F3' },
  { bar: '#6E9B1E', soft: '#EEF5DE' },
  { bar: '#3D6FD6', soft: '#E5ECFB' },
  { bar: '#B247B2', soft: '#F6E5F6' },
  { bar: '#3E9B47', soft: '#E5F4E7' },
  { bar: '#C74A3C', soft: '#FBE8E5' },
  { bar: '#6C5B9E', soft: '#ECE8F6' },
  { bar: '#0B6E74', soft: '#DEF0F1' },
  { bar: '#9B6B3E', soft: '#F2E9DE' },
]
export const colorForIndex = (i: number) =>
  THERAPIST_PALETTE[
    ((i % THERAPIST_PALETTE.length) + THERAPIST_PALETTE.length) % THERAPIST_PALETTE.length
  ]

export type Slot = {
  id: string
  therapistId: string
  clientId: string
  day: Day
  startMin: number
  endMin: number
  status: string
}
export function findConflicts(slots: Slot[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const add = (id: string, r: string) => {
    const a = out.get(id) ?? []
    if (!a.includes(r)) a.push(r)
    out.set(id, a)
  }
  const overlap = (a: Slot, b: Slot) => a.startMin < b.endMin && b.startMin < a.endMin
  const active = slots.filter((s) => s.status !== 'CANCELLED')
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      if (a.day !== b.day || !overlap(a, b)) continue
      if (a.clientId === b.clientId) {
        add(a.id, 'Client double-booked at this time')
        add(b.id, 'Client double-booked at this time')
      }
      if (a.therapistId === b.therapistId) {
        add(a.id, 'Therapist double-booked at this time')
        add(b.id, 'Therapist double-booked at this time')
      }
    }
  return out
}
