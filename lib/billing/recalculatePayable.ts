import { prisma } from '@/lib/prisma'
import { computeEntryPay } from './matcher'
import {
  countPayableSessions,
  computePayableHours,
  parsePayableStatusesJson,
  type ArtemisSessionStatusKey,
} from './sessionStatus'

export async function recalculateCyclePayable(
  cycleId: string,
  payableStatuses?: ArtemisSessionStatusKey[]
): Promise<void> {
  const cycle = await prisma.billingCycle.findUnique({
    where: { id: cycleId },
    select: { payableStatuses: true },
  })
  if (!cycle) throw new Error('Cycle not found')

  const statuses =
    payableStatuses ?? parsePayableStatusesJson(cycle.payableStatuses as unknown)

  const entries = await prisma.billingEntry.findMany({
    where: { billingCycleId: cycleId, isExcluded: false },
    include: {
      sessions: {
        select: { sessionStatus: true, actualMinutes: true },
      },
    },
  })

  let cycleTotalHours = 0
  let cycleTotalGross = 0
  let payableRbtCount = 0

  for (const entry of entries) {
    const payableHours = computePayableHours(entry.sessions, statuses)
    const payableSessionCount = countPayableSessions(entry.sessions, statuses)
    const payableMinutes = payableHours * 60
    const { grossPay, finalPay } = computeEntryPay(
      payableHours,
      entry.hourlyRate,
      entry.adjustment
    )

    await prisma.billingEntry.update({
      where: { id: entry.id },
      data: {
        totalHours: payableHours,
        totalMinutes: payableMinutes,
        totalSessions: payableSessionCount,
        grossPay,
        finalPay,
      },
    })

    if (entry.matchStatus === 'MATCHED' || entry.matchStatus === 'PAYROLL_ONLY') {
      cycleTotalHours += payableHours
      cycleTotalGross += grossPay
      payableRbtCount++
    }
  }

  await prisma.billingCycle.update({
    where: { id: cycleId },
    data: {
      payableStatuses: statuses,
      totalHours: cycleTotalHours,
      totalGrossPay: cycleTotalGross,
      rbtCount: payableRbtCount,
    },
  })
}
