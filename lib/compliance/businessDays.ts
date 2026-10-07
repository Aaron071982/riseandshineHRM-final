/** Weekdays elapsed after `from` up to and including `to` (federal holidays not excluded). */
export function businessDaysBetween(from: Date, to: Date): number {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  if (end <= start) return 0
  let count = 0
  const cursor = new Date(start)
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
}
