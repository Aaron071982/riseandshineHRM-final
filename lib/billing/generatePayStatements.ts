import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ARTEMIS_STATUS,
  computeStatusBreakdown,
  isAlwaysExcludedStatus,
  normalizeArtemisStatus,
  parsePayableStatusesJson,
  type ArtemisSessionStatusKey,
} from './sessionStatus'

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Upsert FINALIZED pay statement snapshots for every MATCHED RBT entry
 * (skips payroll-only / unmatched / excluded). Safe to call on re-finalize.
 */
export async function upsertPayStatementsForCycle(
  cycleId: string,
  client: Tx = prisma
): Promise<{ statementCount: number }> {
  const cycle = await client.billingCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      payableStatuses: true,
    },
  })
  if (!cycle) throw new Error('Cycle not found')

  const payableStatuses = parsePayableStatusesJson(cycle.payableStatuses as unknown)
  const payableSet = new Set(payableStatuses)

  const entries = await client.billingEntry.findMany({
    where: {
      billingCycleId: cycleId,
      isExcluded: false,
      matchStatus: 'MATCHED',
      rbtProfileId: { not: null },
    },
    include: {
      sessions: {
        select: {
          clientName: true,
          dos: true,
          sessionStatus: true,
          rawStatus: true,
          actualMinutes: true,
          procedureCode: true,
        },
        orderBy: { dos: 'asc' },
      },
    },
  })

  let statementCount = 0

  for (const entry of entries) {
    const rbtProfileId = entry.rbtProfileId
    if (!rbtProfileId) continue

    const breakdown = computeStatusBreakdown(entry.sessions)
    const hourlyRate = entry.hourlyRate ?? 0

    const statement = await client.rbtPayStatement.upsert({
      where: {
        rbtProfileId_billingCycleId: {
          rbtProfileId,
          billingCycleId: cycleId,
        },
      },
      create: {
        rbtProfileId,
        billingCycleId: cycleId,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        payableStatuses,
        completedHours: breakdown[ARTEMIS_STATUS.COMPLETED],
        readyToBillHours: breakdown[ARTEMIS_STATUS.READY_TO_BILL],
        incompleteHours: breakdown[ARTEMIS_STATUS.INCOMPLETE],
        inProgressHours: breakdown[ARTEMIS_STATUS.IN_PROGRESS],
        scheduledHours: breakdown[ARTEMIS_STATUS.SCHEDULED],
        payableHours: entry.totalHours,
        hourlyRate,
        grossPay: entry.grossPay,
        adjustment: entry.adjustment,
        finalPay: entry.finalPay,
        status: 'FINALIZED',
      },
      update: {
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        payableStatuses,
        completedHours: breakdown[ARTEMIS_STATUS.COMPLETED],
        readyToBillHours: breakdown[ARTEMIS_STATUS.READY_TO_BILL],
        incompleteHours: breakdown[ARTEMIS_STATUS.INCOMPLETE],
        inProgressHours: breakdown[ARTEMIS_STATUS.IN_PROGRESS],
        scheduledHours: breakdown[ARTEMIS_STATUS.SCHEDULED],
        payableHours: entry.totalHours,
        hourlyRate,
        grossPay: entry.grossPay,
        adjustment: entry.adjustment,
        finalPay: entry.finalPay,
        status: 'FINALIZED',
      },
    })

    await client.rbtPayStatementSession.deleteMany({
      where: { payStatementId: statement.id },
    })

    const sessionRows = entry.sessions
      .map((s) => {
        const key = normalizeArtemisStatus(s.sessionStatus ?? s.rawStatus)
        if (!key || isAlwaysExcludedStatus(key)) return null
        return {
          payStatementId: statement.id,
          clientName: s.clientName || 'Unknown',
          dos: s.dos,
          status: key,
          hours: s.actualMinutes / 60,
          procedureCode: s.procedureCode,
          isPayable: payableSet.has(key as ArtemisSessionStatusKey),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r != null)

    if (sessionRows.length > 0) {
      await client.rbtPayStatementSession.createMany({ data: sessionRows })
    }

    statementCount++
  }

  return { statementCount }
}

/** Remove all pay statements for a cycle (e.g. on reopen) so employees never see unfinalized pay. */
export async function deletePayStatementsForCycle(
  cycleId: string,
  client: Tx = prisma
): Promise<void> {
  await client.rbtPayStatement.deleteMany({ where: { billingCycleId: cycleId } })
}
