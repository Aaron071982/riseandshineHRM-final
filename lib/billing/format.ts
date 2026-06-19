import { format } from 'date-fns'

export function formatCycleLabel(periodStart: Date, periodEnd: Date): string {
  const sameMonth = periodStart.getMonth() === periodEnd.getMonth()
  const sameYear = periodStart.getFullYear() === periodEnd.getFullYear()
  if (sameMonth && sameYear) {
    return `${format(periodStart, 'MMM d')}-${format(periodEnd, 'd, yyyy')}`
  }
  if (sameYear) {
    return `${format(periodStart, 'MMM d')} – ${format(periodEnd, 'MMM d, yyyy')}`
  }
  return `${format(periodStart, 'MMM d, yyyy')} – ${format(periodEnd, 'MMM d, yyyy')}`
}

export function defaultBiweeklyPeriod(): { periodStart: Date; periodEnd: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const daysSinceMonday = (day + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysSinceMonday)

  const periodEnd = new Date(thisMonday)
  periodEnd.setDate(thisMonday.getDate() - 1)
  const periodStart = new Date(periodEnd)
  periodStart.setDate(periodEnd.getDate() - 13)

  return { periodStart, periodEnd }
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatHours(hours: number): string {
  return hours.toFixed(2)
}
