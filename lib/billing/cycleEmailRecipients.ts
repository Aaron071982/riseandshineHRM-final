import type { BillingMatchStatus } from '@prisma/client'
import { isPayableMatchStatus } from '@/lib/billing/entryActions'

export type CycleEmailRecipient = {
  entryId: string
  rbtProfileId: string | null
  payrollOnlyId: string | null
  name: string
  firstName: string
  email: string | null
  totalHours: number
  canEmail: boolean
}

export function mapCycleEmailRecipients(
  entries: {
    id: string
    providerNameRaw: string
    matchStatus: BillingMatchStatus
    totalHours: number
    rbtProfileId: string | null
    payrollOnlyId: string | null
    rbtProfile: { firstName: string; lastName: string; email: string | null } | null
    payrollOnly: { fullName: string; email: string | null } | null
  }[]
): CycleEmailRecipient[] {
  return entries
    .filter((e) => isPayableMatchStatus(e.matchStatus))
    .map((e) => {
      const email = e.rbtProfile?.email ?? e.payrollOnly?.email ?? null
      const name = e.rbtProfile
        ? `${e.rbtProfile.firstName} ${e.rbtProfile.lastName}`
        : (e.payrollOnly?.fullName ?? e.providerNameRaw)
      const firstName = e.rbtProfile?.firstName ?? name.split(' ')[0] ?? name
      return {
        entryId: e.id,
        rbtProfileId: e.rbtProfileId,
        payrollOnlyId: e.payrollOnlyId,
        name,
        firstName,
        email,
        totalHours: e.totalHours,
        canEmail: !!email?.trim() && e.totalHours > 0,
      }
    })
    .filter((r) => r.totalHours > 0)
}
