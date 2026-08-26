import type { Prisma, RBTStatus } from '@prisma/client'

/** RBT pipeline statuses excluded from scheduling, matching, and board pools. */
export const EXCLUDED_FROM_SCHEDULING_STATUSES = ['FIRED', 'REJECTED'] as const satisfies readonly RBTStatus[]

export type ExcludedFromSchedulingStatus = (typeof EXCLUDED_FROM_SCHEDULING_STATUSES)[number]

export const SCHEDULABLE_RBT_WHERE: Prisma.RBTProfileWhereInput = {
  status: { notIn: [...EXCLUDED_FROM_SCHEDULING_STATUSES] },
  activityState: 'ACTIVE',
}

export function isSchedulableRbtStatus(status: RBTStatus): boolean {
  return !(EXCLUDED_FROM_SCHEDULING_STATUSES as readonly string[]).includes(status)
}

/** Placeable when pipeline status is allowed AND activity is ACTIVE. */
export function isSchedulableRbt(profile: {
  status: RBTStatus
  activityState?: string | null
}): boolean {
  if (!isSchedulableRbtStatus(profile.status)) return false
  const state = profile.activityState ?? 'ACTIVE'
  return state === 'ACTIVE'
}
