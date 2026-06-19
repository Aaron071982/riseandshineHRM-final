import type { BillingMatchStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeEntryPay } from './matcher'

export function computeEntryAmounts(
  totalHours: number,
  hourlyRate: number | null,
  adjustment: number
) {
  return computeEntryPay(totalHours, hourlyRate, adjustment)
}

export type RecomputeCycleMode = 'preview' | 'finalized'

export async function recomputeCycleTotals(
  cycleId: string,
  mode: RecomputeCycleMode = 'preview'
): Promise<void> {
  const where =
    mode === 'finalized'
      ? {
          billingCycleId: cycleId,
          isExcluded: false,
          matchStatus: { in: ['MATCHED', 'PAYROLL_ONLY'] as BillingMatchStatus[] },
        }
      : { billingCycleId: cycleId, isExcluded: false }

  const entries = await prisma.billingEntry.findMany({ where })

  let totalHours = 0
  let totalGrossPay = 0

  for (const e of entries) {
    const { grossPay, finalPay } = computeEntryAmounts(e.totalHours, e.hourlyRate, e.adjustment)
    if (e.grossPay !== grossPay || e.finalPay !== finalPay) {
      await prisma.billingEntry.update({
        where: { id: e.id },
        data: { grossPay, finalPay },
      })
    }
    totalHours += e.totalHours
    totalGrossPay += grossPay
  }

  const rbtCount =
    mode === 'finalized'
      ? entries.length
      : entries.filter((e) => e.matchStatus === 'MATCHED' || e.matchStatus === 'PAYROLL_ONLY')
          .length || entries.length

  await prisma.billingCycle.update({
    where: { id: cycleId },
    data: {
      totalHours,
      totalGrossPay,
      rbtCount,
    },
  })
}
