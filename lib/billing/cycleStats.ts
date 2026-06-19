import type { BillingCycle, BillingEntry } from '@prisma/client'

export type CycleDisplayStats = {
  rbtCount: number
  totalHours: number
  totalGrossPay: number
}

export function getCycleDisplayStats(
  cycle: Pick<BillingCycle, 'status' | 'totalHours' | 'totalGrossPay' | 'rbtCount'>,
  entries: Pick<BillingEntry, 'isExcluded' | 'totalHours' | 'grossPay' | 'matchStatus'>[]
): CycleDisplayStats {
  const payrollEntries = entries.filter((e) => !e.isExcluded)

  if (
    (cycle.status === 'FINALIZED' || cycle.status === 'PAID') &&
    cycle.totalHours > 0
  ) {
    return {
      rbtCount: cycle.rbtCount,
      totalHours: cycle.totalHours,
      totalGrossPay: cycle.totalGrossPay,
    }
  }

  if (payrollEntries.length === 0) {
    return {
      rbtCount: cycle.rbtCount,
      totalHours: cycle.totalHours,
      totalGrossPay: cycle.totalGrossPay,
    }
  }

  const payable = payrollEntries.filter(
    (e) => e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY'
  )
  return {
    rbtCount: payable.length > 0 ? payable.length : payrollEntries.length,
    totalHours: payrollEntries.reduce((sum, e) => sum + e.totalHours, 0),
    totalGrossPay: payrollEntries.reduce((sum, e) => sum + e.grossPay, 0),
  }
}
