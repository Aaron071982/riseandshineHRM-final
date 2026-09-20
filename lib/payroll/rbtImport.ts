import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { parseArtemisWorkbook } from '@/lib/billing/artemisParser'
import { matchProviderToRbt } from '@/lib/billing/matcher'
import { loadRbtMatchCandidates, suggestPayRatesForRbts } from '@/lib/billing/payRate'
import { isRbtPayrollPayableSession } from '@/lib/billing/sessionStatus'
import { auditPayrollChange } from '@/lib/payroll/access'
import {
  amountForHours,
  dateToHmmClock,
  hoursBetween,
  recomputeStatementTotals,
  round2,
} from '@/lib/payroll/hoursHmm'
import type { ParsedSessionRow } from '@/lib/billing/types'

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(round2(n).toFixed(2))
}

function clocksFromSession(session: ParsedSessionRow): {
  startClock: string
  endClock: string
  hours: number
} {
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
  // Fallback: payable minutes → hours; synthesize clocks from midnight + duration
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

export type RbtImportResult = {
  statementsCreated: number
  statementsUpdated: number
  lineItemsCreated: number
  unmatchedProviders: string[]
  statementIds: string[]
}

/**
 * Import RBT PayStatements for a pay period from an Artemis Session Reconciliation
 * workbook. Reuses `parseArtemisWorkbook` (same parser as billing cycles).
 */
export async function importRbtStatementsFromArtemisWorkbook(input: {
  payPeriodId: string
  workbookBuffer: Buffer
  actorUserId: string
}): Promise<RbtImportResult> {
  const period = await prisma.payPeriod.findUnique({
    where: { id: input.payPeriodId },
  })
  if (!period) throw new Error('Pay period not found')

  const parsed = await parseArtemisWorkbook(input.workbookBuffer)
  const candidates = await loadRbtMatchCandidates()
  const suggestedRates = await suggestPayRatesForRbts(candidates.map((c) => c.id))

  const unmatchedProviders: string[] = []
  let statementsCreated = 0
  let statementsUpdated = 0
  let lineItemsCreated = 0
  const statementIds: string[] = []

  for (const group of parsed.payrollGroups) {
    const match = matchProviderToRbt(
      group.providerName,
      candidates,
      suggestedRates
    )
    if (match.matchStatus !== 'MATCHED' || !match.rbtProfileId) {
      unmatchedProviders.push(group.providerName)
      continue
    }

    const staffId = match.rbtProfileId
    const rate =
      match.hourlyRate ??
      (
        await prisma.rBTProfile.findUnique({
          where: { id: staffId },
          select: { hourlyPayRate: true },
        })
      )?.hourlyPayRate ??
      null

    if (rate == null || !(rate > 0)) {
      unmatchedProviders.push(`${group.providerName} (no rate)`)
      continue
    }

    // Only pay complete / ready_to_bill / in_progress / incomplete — never scheduled-only.
    const payableSessions = group.sessions.filter(
      (s) => s.actualMinutes > 0 && isRbtPayrollPayableSession(s.sessionStatus)
    )
    if (payableSessions.length === 0) {
      // Clear any prior reconciliation lines so a re-import of scheduled-only
      // hours does not leave a stale stub.
      const existing = await prisma.payStatement.findFirst({
        where: {
          payPeriodId: input.payPeriodId,
          payeeType: 'RBT',
          staffId,
        },
        include: { _count: { select: { lineItems: true } } },
      })
      if (existing && existing.status !== 'SENT') {
        await prisma.payLineItem.deleteMany({
          where: { payStatementId: existing.id, source: 'RECONCILIATION' },
        })
        const remaining = await prisma.payLineItem.findMany({
          where: { payStatementId: existing.id },
          select: { hours: true, amount: true },
        })
        const totals = recomputeStatementTotals(
          remaining.map((i) => ({ hours: Number(i.hours), amount: Number(i.amount) }))
        )
        await prisma.payStatement.update({
          where: { id: existing.id },
          data: {
            totalHours: dec(totals.totalHours),
            grossPay: dec(totals.grossPay),
            deductions: dec(0),
            netPay: dec(totals.netPay),
            reconciled: totals.reconciled,
            status: existing.status === 'READY' ? 'DRAFT' : existing.status,
            pdfUrl: null,
          },
        })
      }
      unmatchedProviders.push(
        `${group.providerName} (no payable hours — scheduled-only excluded)`
      )
      continue
    }

    let statement = await prisma.payStatement.findFirst({
      where: {
        payPeriodId: input.payPeriodId,
        payeeType: 'RBT',
        staffId,
      },
    })

    if (statement && statement.status === 'SENT') {
      unmatchedProviders.push(`${group.providerName} (statement already SENT)`)
      continue
    }

    if (!statement) {
      statement = await prisma.payStatement.create({
        data: {
          payPeriodId: input.payPeriodId,
          payeeType: 'RBT',
          staffId,
          status: 'DRAFT',
          totalHours: dec(0),
          grossPay: dec(0),
          deductions: dec(0),
          netPay: dec(0),
          reconciled: true,
        },
      })
      statementsCreated++
    } else {
      // Replace reconciliation lines for this import (keep MANUAL if any)
      await prisma.payLineItem.deleteMany({
        where: { payStatementId: statement.id, source: 'RECONCILIATION' },
      })
      statementsUpdated++
    }

    statementIds.push(statement.id)

    const lineData = payableSessions.map((session) => {
      const clocks = clocksFromSession(session)
      const hours =
        clocks.hours > 0 ? clocks.hours : round2(session.actualMinutes / 60)
      const amount = amountForHours(hours, rate)
      return {
        payStatementId: statement!.id,
        workDate: session.dos,
        startClock: clocks.startClock,
        endClock: clocks.endClock,
        hours: dec(hours),
        amount: dec(amount),
        source: 'RECONCILIATION' as const,
      }
    })

    if (lineData.length > 0) {
      await prisma.payLineItem.createMany({ data: lineData })
      lineItemsCreated += lineData.length
    }

    const items = await prisma.payLineItem.findMany({
      where: { payStatementId: statement.id },
      select: { hours: true, amount: true },
    })
    const totals = recomputeStatementTotals(
      items.map((i) => ({ hours: Number(i.hours), amount: Number(i.amount) }))
    )
    await prisma.payStatement.update({
      where: { id: statement.id },
      data: {
        totalHours: dec(totals.totalHours),
        grossPay: dec(totals.grossPay),
        deductions: dec(0),
        netPay: dec(totals.netPay),
        reconciled: totals.reconciled,
      },
    })

    await auditPayrollChange({
      actorUserId: input.actorUserId,
      entityType: 'PayStatement',
      entityId: statement.id,
      label: `PAY_STATEMENT_EDIT:rbt_reconciliation_import:${group.providerName}`,
      after: {
        staffId,
        lineItems: lineData.length,
        totalHours: totals.totalHours,
        grossPay: totals.grossPay,
      },
    })
  }

  return {
    statementsCreated,
    statementsUpdated,
    lineItemsCreated,
    unmatchedProviders,
    statementIds,
  }
}
