/** Active clients below this share of authorized weekly hours appear in Staffing queue. */
export const STAFFING_HOURS_UTILIZATION_THRESHOLD = 0.7

export function hoursUtilizationPct(
  scheduledHoursPerWeek: number,
  authHours: number | null | undefined
): number | null {
  if (authHours == null || !Number.isFinite(authHours) || authHours <= 0) return null
  return Math.round((scheduledHoursPerWeek / authHours) * 100)
}

/** True when scheduled weekly hours are strictly below 70% of authorized hours. */
export function isReceivingUnderAuthorizedThreshold(
  scheduledHoursPerWeek: number,
  authHours: number | null | undefined
): boolean {
  if (authHours == null || !Number.isFinite(authHours) || authHours <= 0) return false
  return scheduledHoursPerWeek / authHours < STAFFING_HOURS_UTILIZATION_THRESHOLD
}
