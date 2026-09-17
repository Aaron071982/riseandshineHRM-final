import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { formatCycleLabel } from '@/lib/billing/format'
import {
  amountForHours,
  dateToHmmClock,
  hoursBetween,
  round2,
} from '@/lib/payroll/hoursHmm'

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(round2(n).toFixed(2))
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function clocksFromSession(session: {
  scheduledStart: Date | null
  scheduledEnd: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  actualMinutes: number
}): { startClock: string; endClock: string; hours: number } {
  const start = session.scheduledStart ?? session.actualStart
  const end = session.scheduledEnd ?? session.actualEnd
  if (start && end) {
    const startClock = dateToHmmClock(start, true)
    const endClock = dateToHmmClock(end, true)
    const fromClocks = hoursBetween(startClock, endClock)
    if (fromClocks > 0) {
      return { startClock, endClock, hours: fromClocks }
    }
  }
  const hours = round2(session.actualMinutes / 60)
  const mins = Math.round(hours * 60)
  const endH = Math.floor(mins / 60)
  const endM = mins % 60
  return {
    startClock: '0.00',
    endClock: `${endH}.${String(endM).padStart(2, '0')}`,
    hours,
  }
}

export type MigrateBillingCyclesResult = {
  periodsCreated: number
  periodsReused: number
  statementsCreated: number
  statementsUpdated: number
  lineItemsCreated: number
  cyclesProcessed: number
  skippedEntries: number
}

/**
 * Idempotent: copy Artemis BillingCycle RBT payroll into unified PayPeriod /
 * PayStatement / PayLineItem rows so the Payroll tab shows historical cycles.
 */
export async function migrateBillingCyclesToPayPeriods(): Promise<MigrateBillingCyclesResult> {
  const cycles = await prisma.billingCycle.findMany({
    orderBy: { periodStart: 'asc' },
    include: {
      entries: {
        where: {
          isExcluded: false,
          matchStatus: { in: ['MATCHED', 'PAYROLL_ONLY'] },
          rbtProfileId: { not: null },
        },
        include: {
          sessions: {
            orderBy: [{ dos: 'asc' }, { scheduledStart: 'asc' }],
          },
        },
      },
    },
  })

  let periodsCreated = 0
  let periodsReused = 0
  let statementsCreated = 0
  let statementsUpdated = 0
  let lineItemsCreated = 0
  let skippedEntries = 0

  for (const cycle of cycles) {
    const label = cycle.label?.trim() || formatCycleLabel(cycle.periodStart, cycle.periodEnd)
    // Pay date ≈ end of period + 7 days (typical biweekly lag); stable for idempotency.
    const payDate = addDays(cycle.periodEnd, 7)

    let period = await prisma.payPeriod.findFirst({
      where: {
        startDate: cycle.periodStart,
        endDate: cycle.periodEnd,
      },
    })

    if (!period) {
      period = await prisma.payPeriod.create({
        data: {
          startDate: cycle.periodStart,
          endDate: cycle.periodEnd,
          payDate,
          label,
        },
      })
      periodsCreated++
    } else {
      periodsReused++
      if (period.label !== label) {
        period = await prisma.payPeriod.update({
          where: { id: period.id },
          data: { label },
        })
      }
    }

    const statementStatus =
      cycle.status === 'FINALIZED' || cycle.status === 'PAID' ? 'READY' : 'DRAFT'

    for (const entry of cycle.entries) {
      const staffId = entry.rbtProfileId
      if (!staffId) {
        skippedEntries++
        continue
      }

      const rate = entry.hourlyRate
      if (rate == null || !(rate > 0)) {
        skippedEntries++
        continue
      }

      let statement = await prisma.payStatement.findFirst({
        where: {
          payPeriodId: period.id,
          payeeType: 'RBT',
          staffId,
        },
      })

      // Don't overwrite statements that were already sent from the new hub.
      if (statement?.status === 'SENT') {
        skippedEntries++
        continue
      }

      if (!statement) {
        statement = await prisma.payStatement.create({
          data: {
            payPeriodId: period.id,
            payeeType: 'RBT',
            staffId,
            status: statementStatus,
            totalHours: dec(0),
            grossPay: dec(0),
            deductions: dec(0),
            netPay: dec(0),
            reconciled: true,
          },
        })
        statementsCreated++
      } else {
        await prisma.payStatement.update({
          where: { id: statement.id },
          data: { status: statementStatus },
        })
        statementsUpdated++
      }

      // Replace reconciliation lines so re-runs stay idempotent.
      await prisma.payLineItem.deleteMany({
        where: { payStatementId: statement.id, source: 'RECONCILIATION' },
      })

      const sessions = entry.sessions
      if (sessions.length > 0) {
        for (const session of sessions) {
          const { startClock, endClock, hours } = clocksFromSession(session)
          if (!(hours > 0)) continue
          const amount = amountForHours(hours, rate)
          await prisma.payLineItem.create({
            data: {
              payStatementId: statement.id,
              workDate: session.dos,
              startClock,
              endClock,
              hours: dec(hours),
              amount: dec(amount),
              source: 'RECONCILIATION',
            },
          })
          lineItemsCreated++
        }
      } else if (entry.totalHours > 0) {
        // Aggregate fallback when session rows are missing.
        const hours = round2(entry.totalHours)
        const amount =
          entry.finalPay > 0
            ? round2(entry.finalPay)
            : entry.grossPay > 0
              ? round2(entry.grossPay)
              : amountForHours(hours, rate)
        await prisma.payLineItem.create({
          data: {
            payStatementId: statement.id,
            workDate: cycle.periodStart,
            startClock: '0.00',
            endClock: `${Math.floor(hours)}.${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`,
            hours: dec(hours),
            amount: dec(amount),
            source: 'RECONCILIATION',
          },
        })
        lineItemsCreated++
      } else {
        skippedEntries++
        continue
      }

      const items = await prisma.payLineItem.findMany({
        where: { payStatementId: statement.id },
        select: { hours: true, amount: true },
      })
      const totalHours = round2(items.reduce((s, i) => s + Number(i.hours), 0))
      const sumAmounts = round2(items.reduce((s, i) => s + Number(i.amount), 0))
      // Prefer cycle final pay when present (adjustments).
      const gross =
        entry.finalPay > 0
          ? round2(entry.finalPay)
          : entry.grossPay > 0
            ? round2(entry.grossPay)
            : sumAmounts
      const reconciled = Math.abs(gross - sumAmounts) < 0.02

      await prisma.payStatement.update({
        where: { id: statement.id },
        data: {
          totalHours: dec(totalHours),
          grossPay: dec(gross),
          deductions: dec(0),
          netPay: dec(gross),
          reconciled,
          status: statementStatus,
        },
      })
    }
  }

  return {
    periodsCreated,
    periodsReused,
    statementsCreated,
    statementsUpdated,
    lineItemsCreated,
    cyclesProcessed: cycles.length,
    skippedEntries,
  }
}

/** Backfill once when the unified Payroll tab has no periods yet. */
export async function ensurePayPeriodsFromBillingCycles(): Promise<MigrateBillingCyclesResult | null> {
  const existing = await prisma.payPeriod.count()
  if (existing > 0) return null
  const cycleCount = await prisma.billingCycle.count()
  if (cycleCount === 0) return null
  return migrateBillingCyclesToPayPeriods()
}
