import type { Prisma, RBTStatus } from '@prisma/client'

/** RBT pipeline statuses excluded from scheduling, matching, and board pools. */
export const EXCLUDED_FROM_SCHEDULING_STATUSES = ['FIRED', 'REJECTED'] as const satisfies readonly RBTStatus[]

export type ExcludedFromSchedulingStatus = (typeof EXCLUDED_FROM_SCHEDULING_STATUSES)[number]

export const SCHEDULABLE_RBT_WHERE: Prisma.RBTProfileWhereInput = {
  status: { notIn: [...EXCLUDED_FROM_SCHEDULING_STATUSES] },
}

export function isSchedulableRbtStatus(status: RBTStatus): boolean {
  return !(EXCLUDED_FROM_SCHEDULING_STATUSES as readonly string[]).includes(status)
}
