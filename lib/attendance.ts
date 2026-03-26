export type SessionFlagStatus = 'COMPLETE' | 'IN_PROGRESS' | 'FLAGGED'

export function formatDurationHM(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

export function durationSeconds(clockInTime: Date, clockOutTime?: Date | null): number {
  const end = clockOutTime ?? new Date()
  return Math.max(0, Math.floor((end.getTime() - new Date(clockInTime).getTime()) / 1000))
}

export function sessionStatus(clockInTime: Date, clockOutTime?: Date | null): SessionFlagStatus {
  if (clockOutTime) {
    const durHours = durationSeconds(clockInTime, clockOutTime) / 3600
    return durHours > 8 ? 'FLAGGED' : 'COMPLETE'
  }
  const openHours = durationSeconds(clockInTime, null) / 3600
  if (openHours >= 12) return 'FLAGGED'
  return 'IN_PROGRESS'
}

function getNowInEasternParts(now: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday || 'Sun'] ?? 0,
  }
}

function easternMidnightUtc(year: number, month: number, day: number): Date {
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const nyHour = Number(
    probe.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    })
  )
  const offsetHours = 12 - nyHour
  return new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0))
}

export function getEasternWeekStart(now = new Date()): Date {
  const parts = getNowInEasternParts(now)
  const sundayDay = parts.day - parts.weekday
  return easternMidnightUtc(parts.year, parts.month, sundayDay)
}

export function getEasternMonthStart(now = new Date()): Date {
  const parts = getNowInEasternParts(now)
  return easternMidnightUtc(parts.year, parts.month, 1)
}

export function getEasternDateLabel(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
