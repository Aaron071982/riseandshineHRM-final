import type { Prisma, RbtScheduleReviewStatus } from '@prisma/client'

/** Rows that appear on the live schedule (not provisional, not discarded). */
export const LIVE_REVIEW_STATUSES: RbtScheduleReviewStatus[] = ['NONE', 'CONFIRMED']

export const LIVE_ASSIGNMENT_WHERE: Prisma.RbtScheduleAssignmentWhereInput = {
  isActive: true,
  deletedAt: null,
  reviewStatus: { in: LIVE_REVIEW_STATUSES },
}
