import { easternToUTC, getEasternDate } from '@/lib/eastern-time'

export type AdminAvailabilityRange = {
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
}

export type AdminDayAvailability = {
  dayOfWeek: number
  enabled: boolean
  ranges: AdminAvailabilityRange[]
}

/**
 * Mirrors slot generation in `app/api/public/interviewer-slots/route.ts` for a single
 * interviewer — used for admin UI preview without saving.
 */
export function previewAvailabilitySlots(params: {
  acceptInterviewBookings: boolean
  slotDurationMinutes: number
  bufferMinutes: number
  availability: AdminDayAvailability[]
  daysAhead?: number
  now?: Date
}): Array<{ dateKey: string; label: string; times: string[] }> {
  if (!params.acceptInterviewBookings) return []

  const daysAhead = Math.min(30, Math.max(1, params.daysAhead ?? 7))
  const now = params.now ?? new Date()
  const durationMinutes = params.slotDurationMinutes
  const bufferMinutes = params.bufferMinutes
  const stepMinutes = durationMinutes + bufferMinutes

  const todayEasternYMD = getEasternDate(now)
  const byDate = new Map<string, Date[]>()

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const easternMiddayUTC = easternToUTC(
      todayEasternYMD.year,
      todayEasternYMD.month,
      todayEasternYMD.day + dayOffset,
      12,
      0
    )
    const easternYMD = getEasternDate(easternMiddayUTC)
    const dayOfWeek = easternMiddayUTC.getUTCDay()
    const dateKey = `${easternYMD.year}-${String(easternYMD.month).padStart(2, '0')}-${String(easternYMD.day).padStart(2, '0')}`

    const dayConfig = params.availability.find((d) => d.dayOfWeek === dayOfWeek)
    if (!dayConfig?.enabled) continue

    for (const availability of dayConfig.ranges) {
      const availabilityStartLocal = availability.startHour * 60 + availability.startMinute
      const availabilityEndLocal = availability.endHour * 60 + availability.endMinute

      for (
        let slotStartLocalMinutes = availabilityStartLocal;
        slotStartLocalMinutes + durationMinutes <= availabilityEndLocal;
        slotStartLocalMinutes += stepMinutes
      ) {
        const slotStartHour = Math.floor(slotStartLocalMinutes / 60)
        const slotStartMinute = slotStartLocalMinutes % 60

        const slotStartUTC = easternToUTC(
          easternYMD.year,
          easternYMD.month,
          easternYMD.day,
          slotStartHour,
          slotStartMinute
        )

        if (slotStartUTC < now) continue

        if (!byDate.has(dateKey)) byDate.set(dateKey, [])
        byDate.get(dateKey)!.push(slotStartUTC)
      }
    }
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })

  const labelFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const result: Array<{ dateKey: string; label: string; times: string[] }> = []

  const sortedKeys = [...byDate.keys()].sort()
  for (const dateKey of sortedKeys) {
    const starts = byDate.get(dateKey)!.sort((a, b) => a.getTime() - b.getTime())
    const times = starts.map((d) => formatter.format(d))
    const label = labelFormatter.format(starts[0]!)
    result.push({ dateKey, label, times })
  }

  return result
}
