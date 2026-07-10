import { randomBytes } from 'crypto'
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

const LOG = '[generatePayStatements]'

function newCuidLike(): string {
  return `c${randomBytes(12).toString('hex')}`
}

function assertPayStatementDelegate(client: Tx): void {
  const delegate = (client as { rbtPayStatement?: unknown }).rbtPayStatement
  if (!delegate) {
    throw new Error(
      `${LOG} prisma.rbtPayStatement is undefined — run prisma generate and ensure rbt_pay_statements migration is applied`
    )
  }
}

/**
 * Upsert FINALIZED pay statement snapshots for every MATCHED RBT entry
 * (skips payroll-only / unmatched / excluded). Safe to call on re-finalize.
 */
export async function upsertPayStatementsForCycle(
  cycleId: string,
  client: Tx = prisma
): Promise<{ statementCount: number; eligible: number; skipped: number }> {
  console.log(`${LOG} start cycleId=${cycleId}`)
  assertPayStatementDelegate(client)

  const cycle = await client.billingCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      payableStatuses: true,
      status: true,
    },
  })
  if (!cycle) throw new Error(`${LOG} Cycle not found: ${cycleId}`)

  const payableStatuses = parsePayableStatusesJson(cycle.payableStatuses as unknown)
  const payableSet = new Set(payableStatuses)
  console.log(
    `${LOG} cycle status=${cycle.status} payableStatuses=${JSON.stringify(payableStatuses)}`
  )

  // Diagnostic: all non-deleted-looking entries for this cycle
  const allEntries = await client.billingEntry.findMany({
    where: { billingCycleId: cycleId },
    select: {
      id: true,
      matchStatus: true,
      rbtProfileId: true,
      payrollOnlyId: true,
      isExcluded: true,
      providerNameRaw: true,
      finalPay: true,
      totalHours: true,
    },
  })

  const skipReasons: Record<string, number> = {
    excluded: 0,
    not_matched: 0,
    missing_rbtProfileId: 0,
    payroll_only: 0,
  }
  for (const e of allEntries) {
    if (e.isExcluded) {
      skipReasons.excluded++
      continue
    }
    if (e.matchStatus !== 'MATCHED') {
      skipReasons.not_matched++
      continue
    }
    if (!e.rbtProfileId) {
      skipReasons.missing_rbtProfileId++
      continue
    }
    if (e.payrollOnlyId && !e.rbtProfileId) {
      skipReasons.payroll_only++
    }
  }

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

  console.log(
    `${LOG} entries total=${allEntries.length} eligible=${entries.length} skips=${JSON.stringify(skipReasons)}`
  )
  if (entries.length > 0) {
    console.log(
      `${LOG} eligible sample:`,
      entries.slice(0, 5).map((e) => ({
        id: e.id,
        name: e.providerNameRaw,
        rbtProfileId: e.rbtProfileId,
        hours: e.totalHours,
        finalPay: e.finalPay,
        sessions: e.sessions.length,
      }))
    )
  }

  let statementCount = 0

  for (const entry of entries) {
    const rbtProfileId = entry.rbtProfileId
    if (!rbtProfileId) {
      console.warn(`${LOG} skip entry ${entry.id}: rbtProfileId null after filter`)
      continue
    }

    try {
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

      // Explicit ids: raw SQL migration has no DB default on id; createMany won't apply @default(cuid())
      const sessionRows = entry.sessions
        .map((s) => {
          const key = normalizeArtemisStatus(s.sessionStatus ?? s.rawStatus)
          if (!key || isAlwaysExcludedStatus(key)) return null
          return {
            id: newCuidLike(),
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
    } catch (err) {
      console.error(
        `${LOG} FAILED entry id=${entry.id} name=${entry.providerNameRaw} rbtProfileId=${rbtProfileId}`,
        err
      )
      throw err
    }
  }

  const skipped = allEntries.length - entries.length
  console.log(
    `${LOG} end cycleId=${cycleId} statementCount=${statementCount} eligible=${entries.length} skipped=${skipped}`
  )

  return { statementCount, eligible: entries.length, skipped }
}

/** Remove all pay statements for a cycle (e.g. on reopen) so employees never see unfinalized pay. */
export async function deletePayStatementsForCycle(
  cycleId: string,
  client: Tx = prisma
): Promise<number> {
  console.log(`${LOG} deletePayStatements start cycleId=${cycleId}`)
  assertPayStatementDelegate(client)
  const result = await client.rbtPayStatement.deleteMany({ where: { billingCycleId: cycleId } })
  console.log(`${LOG} deletePayStatements end cycleId=${cycleId} deleted=${result.count}`)
  return result.count
}
