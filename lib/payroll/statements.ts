import { prisma } from '@/lib/prisma'
import { Prisma, type LineSource, type PayStatementStatus } from '@prisma/client'
import { auditPayrollChange } from '@/lib/payroll/access'
import {
  computeLine,
  recomputeStatementTotals,
  round2,
} from '@/lib/payroll/hoursHmm'
import { getActiveContractorRate } from '@/lib/payroll/contractors'

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(round2(n).toFixed(2))
}

export async function upsertPayPeriod(input: {
  startDate: Date
  endDate: Date
  payDate: Date
  label: string
}): Promise<{ id: string; label: string }> {
  const existing = await prisma.payPeriod.findFirst({
    where: {
      startDate: input.startDate,
      endDate: input.endDate,
      payDate: input.payDate,
    },
  })
  if (existing) {
    if (existing.label !== input.label) {
      return prisma.payPeriod.update({
        where: { id: existing.id },
        data: { label: input.label },
        select: { id: true, label: true },
      })
    }
    return { id: existing.id, label: existing.label }
  }
  return prisma.payPeriod.create({
    data: {
      startDate: input.startDate,
      endDate: input.endDate,
      payDate: input.payDate,
      label: input.label,
    },
    select: { id: true, label: true },
  })
}

async function applyTotals(
  statementId: string,
  opts?: { deductions?: number; grossOverride?: number | null }
) {
  const items = await prisma.payLineItem.findMany({
    where: { payStatementId: statementId },
    select: { hours: true, amount: true },
  })
  const totals = recomputeStatementTotals(
    items.map((i) => ({ hours: Number(i.hours), amount: Number(i.amount) })),
    {
      deductions: opts?.deductions,
      grossOverride:
        opts?.grossOverride === null ? undefined : opts?.grossOverride,
    }
  )
  return prisma.payStatement.update({
    where: { id: statementId },
    data: {
      totalHours: dec(totals.totalHours),
      grossPay: dec(totals.grossPay),
      deductions: dec(totals.deductions),
      netPay: dec(totals.netPay),
      reconciled: totals.reconciled,
    },
  })
}

/** Create or fetch DRAFT BCBA statement for contractor + period; uses active rate. */
export async function ensureBcbaPayStatement(input: {
  payPeriodId: string
  contractorId: string
  actorUserId: string
  ratePerHour?: number
}): Promise<{ id: string; ratePerHour: number }> {
  const rate =
    input.ratePerHour ?? (await getActiveContractorRate(input.contractorId))
  if (rate == null || !(rate > 0)) {
    throw new Error('Set a pay rate for this contractor before creating a statement')
  }

  const existing = await prisma.payStatement.findFirst({
    where: {
      payPeriodId: input.payPeriodId,
      payeeType: 'BCBA',
      contractorId: input.contractorId,
    },
  })
  if (existing) return { id: existing.id, ratePerHour: rate }

  const created = await prisma.payStatement.create({
    data: {
      payPeriodId: input.payPeriodId,
      payeeType: 'BCBA',
      contractorId: input.contractorId,
      status: 'DRAFT',
      totalHours: dec(0),
      grossPay: dec(0),
      deductions: dec(0),
      netPay: dec(0),
      reconciled: true,
    },
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: created.id,
    label: `PAY_STATEMENT_CREATE:BCBA:${input.contractorId}`,
    after: { payPeriodId: input.payPeriodId, ratePerHour: rate },
  })

  return { id: created.id, ratePerHour: rate }
}

export async function addBcbaManualLineItem(input: {
  payStatementId: string
  workDate: Date
  startClock: string
  endClock: string
  ratePerHour?: number
  actorUserId: string
}): Promise<{ id: string; hours: number; amount: number; reconciled: boolean }> {
  const statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
    include: { contractor: true },
  })
  if (!statement || statement.payeeType !== 'BCBA' || !statement.contractorId) {
    throw new Error('BCBA pay statement not found')
  }
  if (statement.status === 'SENT') {
    throw new Error('Cannot edit a sent pay statement')
  }

  const rate =
    input.ratePerHour ??
    (await getActiveContractorRate(statement.contractorId))
  if (rate == null || !(rate > 0)) {
    throw new Error('No active rate for contractor')
  }

  const { hours, amount } = computeLine({
    startClock: input.startClock,
    endClock: input.endClock,
    ratePerHour: rate,
  })
  if (hours <= 0) {
    throw new Error('End clock must be after start clock (h.mm, same day)')
  }

  const item = await prisma.payLineItem.create({
    data: {
      payStatementId: statement.id,
      workDate: input.workDate,
      startClock: input.startClock.trim(),
      endClock: input.endClock.trim(),
      hours: dec(hours),
      amount: dec(amount),
      source: 'MANUAL' satisfies LineSource,
    },
  })

  const updated = await applyTotals(statement.id)

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: statement.id,
    label: `PAY_STATEMENT_EDIT:add_line:${item.id}`,
    after: {
      lineItemId: item.id,
      hours,
      amount,
      startClock: input.startClock,
      endClock: input.endClock,
      workDate: input.workDate.toISOString(),
    },
  })

  return {
    id: item.id,
    hours,
    amount,
    reconciled: updated.reconciled,
  }
}

export async function removePayLineItem(input: {
  lineItemId: string
  actorUserId: string
}): Promise<{ reconciled: boolean }> {
  const item = await prisma.payLineItem.findUnique({
    where: { id: input.lineItemId },
    include: { payStatement: true },
  })
  if (!item) throw new Error('Line item not found')
  if (item.payStatement.status === 'SENT') {
    throw new Error('Cannot edit a sent pay statement')
  }

  await prisma.payLineItem.delete({ where: { id: item.id } })
  const updated = await applyTotals(item.payStatementId)

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: item.payStatementId,
    label: `PAY_STATEMENT_EDIT:remove_line:${item.id}`,
    before: {
      hours: Number(item.hours),
      amount: Number(item.amount),
    },
  })

  return { reconciled: updated.reconciled }
}

/**
 * Optional gross override. When it differs from Σ line amounts, reconciled=false.
 * Pass null to clear override and restore gross from line items.
 */
export async function setPayStatementGrossOverride(input: {
  payStatementId: string
  grossOverride: number | null
  actorUserId: string
}): Promise<{ reconciled: boolean; grossPay: number }> {
  const statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
  })
  if (!statement) throw new Error('Pay statement not found')
  if (statement.status === 'SENT') {
    throw new Error('Cannot edit a sent pay statement')
  }

  const before = Number(statement.grossPay)
  const final = await applyTotals(statement.id, {
    deductions: Number(statement.deductions),
    ...(input.grossOverride != null
      ? { grossOverride: input.grossOverride }
      : {}),
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: statement.id,
    label: `PAY_STATEMENT_EDIT:gross_override:${before}→${Number(final.grossPay)}`,
    before: { grossPay: before, reconciled: statement.reconciled },
    after: {
      grossPay: Number(final.grossPay),
      reconciled: final.reconciled,
      grossOverride: input.grossOverride,
    },
  })

  return { reconciled: final.reconciled, grossPay: Number(final.grossPay) }
}

export async function setPayStatementStatus(input: {
  payStatementId: string
  status: PayStatementStatus
  actorUserId: string
}): Promise<void> {
  const statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
  })
  if (!statement) throw new Error('Pay statement not found')

  await prisma.payStatement.update({
    where: { id: statement.id },
    data: {
      status: input.status,
      sentAt: input.status === 'SENT' ? new Date() : statement.sentAt,
    },
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: statement.id,
    label: `PAY_STATEMENT_EDIT:status:${statement.status}→${input.status}`,
    before: { status: statement.status },
    after: { status: input.status },
  })
}

export { applyTotals }
