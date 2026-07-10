/** Add N working days (Mon–Fri) to a date. */
export function addWorkingDays(start: Date, workingDays: number): Date {
  const result = new Date(start)
  let added = 0
  while (added < workingDays) {
    result.setDate(result.getDate() + 1)
    const day = result.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return result
}

/** Last calendar day of the month containing `date`. */
export function endOfCoverageMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/** Next Friday on or after `date` (simple NY biweekly-ish payday heuristic). */
export function nextRegularPayday(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const daysUntilFriday = (5 - day + 7) % 7
  result.setDate(result.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday))
  return result
}

export function computeTerminationDates(terminationDate: Date) {
  return {
    benefitsEndDate: endOfCoverageMonth(terminationDate),
    finalPayDate: nextRegularPayday(terminationDate),
    noticeDeadline: addWorkingDays(terminationDate, 5),
  }
}

export function formatDateNY(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
