import { differenceInYears, format, startOfDay } from 'date-fns'

/** Privacy: "Maria R." */
export function formatCrmClientListName(firstName: string, lastName: string): string {
  const initial = (lastName.trim()[0] ?? '').toUpperCase()
  return `${firstName.trim()} ${initial ? `${initial}.` : ''}`.trim()
}

export function calcAgeFromDob(dob: Date | null | undefined): number | null {
  if (!dob) return null
  return differenceInYears(new Date(), dob)
}

export type AuthExpiryTone = 'green' | 'amber' | 'red'

/** Green >60d, amber 30–60d, red <30d or expired. */
export function authExpiryTone(endDate: Date | null | undefined, now = new Date()): AuthExpiryTone {
  if (!endDate) return 'green'
  const end = startOfDay(endDate)
  const today = startOfDay(now)
  const diffMs = end.getTime() - today.getTime()
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  if (days < 0) return 'red'
  if (days < 30) return 'red'
  if (days <= 60) return 'amber'
  return 'green'
}

/** MM/DD/YYYY (local) */
export function formatMMDDYYYY(d: Date | null | undefined): string {
  if (!d) return '—'
  return format(new Date(d), 'MM/dd/yyyy')
}

/** Used vs cumulative authorized hours since auth start (plan formula). */
export function cumulativeAuthorizedHoursBudget(params: {
  authorizedHoursPerWeek: number | null | undefined
  authorizationStartDate: Date | null | undefined
  now?: Date
}): number | null {
  const perWeek = params.authorizedHoursPerWeek
  const start = params.authorizationStartDate
  if (perWeek == null || perWeek <= 0 || !start) return null
  const now = params.now ?? new Date()
  const ms = Math.max(0, now.getTime() - startOfDay(start).getTime())
  const weeks = ms / (7 * 24 * 60 * 60 * 1000)
  return perWeek * Math.max(weeks, 1 / 7) // at least partial first week
}

export function hoursRunningLow(params: {
  usedHoursTotal: number
  authorizedHoursPerWeek: number | null | undefined
  authorizationStartDate: Date | null | undefined
}): boolean {
  const budget = cumulativeAuthorizedHoursBudget(params)
  if (budget == null || budget <= 0) return false
  return params.usedHoursTotal > 0.8 * budget
}
