import {
  getClientSchedulePeriod,
  schedulePeriodWhere,
} from '@/lib/client-services/schedulePeriod'
import { sumScheduledWeeklyHours } from '@/lib/client-services/serviceStatus'
import { prisma } from '@/lib/prisma'

/** Default weekly hour cap when preferredHoursRange is not set. */
export const DEFAULT_RBT_WEEKLY_HOUR_CAP = 40

export function parseWeeklyHourCap(
  preferredHoursRange: string | null | undefined
): number {
  if (!preferredHoursRange?.trim()) return DEFAULT_RBT_WEEKLY_HOUR_CAP
  const nums = preferredHoursRange.match(/\d+/g)?.map(Number) ?? []
  if (!nums.length) return DEFAULT_RBT_WEEKLY_HOUR_CAP
  return Math.max(...nums)
}

export function therapistHasCapacity(
  scheduledHoursPerWeek: number,
  weeklyHourCap: number
): boolean {
  return scheduledHoursPerWeek < weeklyHourCap
}

/** Sum active period schedule hours per RBT profile. */
export async function loadRbtScheduledHoursByProfileId(): Promise<
  Map<string, number>
> {
  const period = await getClientSchedulePeriod()
  const periodFilter = schedulePeriodWhere(period)
  const rows = await prisma.rbtScheduleAssignment.findMany({
    where: {
      ...periodFilter,
      deletedAt: null,
      isActive: true,
    },
    select: {
      rbtProfileId: true,
      startTime: true,
      endTime: true,
      isActive: true,
    },
  })

  const byRbt = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byRbt.get(row.rbtProfileId) ?? []
    list.push(row)
    byRbt.set(row.rbtProfileId, list)
  }

  const out = new Map<string, number>()
  for (const [id, slots] of byRbt) {
    out.set(id, sumScheduledWeeklyHours(slots))
  }
  return out
}
