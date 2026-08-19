/** Projected weekly hours vs authorized. Warn (do not block) when over. */
export function authorizedHoursWarning(opts: {
  currentHours: number
  addedHours: number
  authHours: number | null | undefined
}): { projectedHours: number; over: boolean; warning?: string } {
  const projectedHours =
    Math.round((opts.currentHours + opts.addedHours) * 10) / 10
  const auth = opts.authHours
  if (auth == null || !Number.isFinite(auth) || auth <= 0) {
    return { projectedHours, over: false }
  }
  const over = projectedHours > auth + 0.05
  return {
    projectedHours,
    over,
    warning: over
      ? `Scheduled hours (${projectedHours.toFixed(1)}) exceed authorized weekly hours (${auth}).`
      : undefined,
  }
}
