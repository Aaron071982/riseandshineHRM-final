import type { Prisma } from '@prisma/client'
import { I9_DOCUMENT_TYPE } from '@/lib/rbtDocumentsSync'

/** Identity / work-authorization documents uploaded alongside Form I-9 Section 1. */
export const I9_SUPPORTING_DOCUMENT_TYPE = 'I9_SUPPORTING_DOCUMENT'

export const I9_DOCUMENT_TYPES = [I9_DOCUMENT_TYPE, I9_SUPPORTING_DOCUMENT_TYPE] as const

/** Hired staff still employed: excludes terminations and departures whose last day has passed. */
export function currentlyEmployedWhere(now = new Date()): Prisma.RBTProfileWhereInput {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return {
    status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] },
    terminatedAt: null,
    termination: { is: null },
    OR: [{ departureLastDay: null }, { departureLastDay: { gte: today } }],
  }
}

/** No Section 1 on record and no Form I-9 filed in Documents. */
export const i9MissingWhere: Prisma.RBTProfileWhereInput = {
  i9Section1CompletedAt: null,
  documents: { none: { documentType: I9_DOCUMENT_TYPE } },
}

export function hasI9OnFile(profile: {
  i9Section1CompletedAt: Date | null
  i9FormCount: number
}): boolean {
  return profile.i9Section1CompletedAt != null || profile.i9FormCount > 0
}
