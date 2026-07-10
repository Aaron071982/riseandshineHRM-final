export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Display order Mon→Sun for calendar headers */
export const CALENDAR_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const CALENDAR_START_HOUR = 7
export const CALENDAR_END_HOUR = 20

export type ScheduleAssignmentDTO = {
  id: string
  rbtProfileId: string
  clientName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string | null
  notes: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function parseTimeToMinutes(time: string): number | null {
  const m = TIME_RE.exec(time.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTime12h(time: string): string {
  const mins = parseTimeToMinutes(time)
  if (mins == null) return time
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function hoursBetween(startTime: string, endTime: string): number {
  const a = parseTimeToMinutes(startTime)
  const b = parseTimeToMinutes(endTime)
  if (a == null || b == null || b <= a) return 0
  return (b - a) / 60
}

export function validateAssignmentTimes(startTime: string, endTime: string): string | null {
  const a = parseTimeToMinutes(startTime)
  const b = parseTimeToMinutes(endTime)
  if (a == null || b == null) return 'Start and end times must be HH:MM (24h)'
  if (b <= a) return 'End time must be after start time'
  return null
}

/** Stable pastel color from client name */
export function colorForClient(name: string): { bg: string; border: string; text: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const palette = [
    { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-900' },
    { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-900' },
    { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-900' },
    { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-900' },
    { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-900' },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-900' },
    { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
    { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-900' },
  ]
  return palette[hash % palette.length]
}

export function weeklyHours(assignments: Pick<ScheduleAssignmentDTO, 'startTime' | 'endTime' | 'isActive'>[]): number {
  return assignments
    .filter((a) => a.isActive !== false)
    .reduce((sum, a) => sum + hoursBetween(a.startTime, a.endTime), 0)
}

export function groupAssignmentsByClient(
  assignments: ScheduleAssignmentDTO[]
): { clientName: string; days: number[]; startTime: string; endTime: string; location: string | null; notes: string | null; ids: string[] }[] {
  const map = new Map<string, ScheduleAssignmentDTO[]>()
  for (const a of assignments) {
    const key = `${a.clientName}|${a.startTime}|${a.endTime}|${a.location ?? ''}|${a.notes ?? ''}`
    const list = map.get(key) ?? []
    list.push(a)
    map.set(key, list)
  }
  return Array.from(map.values()).map((list) => ({
    clientName: list[0].clientName,
    days: [...new Set(list.map((x) => x.dayOfWeek))].sort((a, b) => {
      const order = CALENDAR_DAY_ORDER as readonly number[]
      return order.indexOf(a) - order.indexOf(b)
    }),
    startTime: list[0].startTime,
    endTime: list[0].endTime,
    location: list[0].location,
    notes: list[0].notes,
    ids: list.map((x) => x.id),
  }))
}
