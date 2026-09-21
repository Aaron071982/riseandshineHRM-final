import 'server-only'

import { prisma } from '@/lib/prisma'
import { auditPayrollChange } from '@/lib/payroll/access'
import { renderPayStubPdf } from '@/lib/payroll/renderPayStubPdf'
import {
  buildPayStubStoragePath,
  uploadPayStubPdf,
} from '@/lib/payroll/payStubStorage'
import { getActiveContractorRate } from '@/lib/payroll/contractors'
import {
  normalizePayeeClassification,
  type PayeeClassification,
} from '@/lib/payroll/classification'
import {
  deductionsFromLegacyPayrollEntry,
  replacePayDeductions,
} from '@/lib/payroll/deductions'
import { estimateW2EmployeeDeductions } from '@/lib/payroll/estimateW2Taxes'
import { round2 } from '@/lib/payroll/hoursHmm'
import { revalidatePath } from 'next/cache'

async function loadYtdForPayee(input: {
  payeeType: 'BCBA' | 'RBT'
  contractorId: string | null
  staffId: string | null
  payDate: Date
  excludeStatementId: string
}): Promise<{
  gross: number
  deductions: number
  net: number
  byLabel: Array<{ label: string; amount: number }>
} | null> {
  const year = input.payDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59))

  const prior = await prisma.payStatement.findMany({
    where: {
      id: { not: input.excludeStatementId },
      payeeType: input.payeeType,
      status: { in: ['READY', 'SENT'] },
      ...(input.payeeType === 'BCBA'
        ? { contractorId: input.contractorId ?? undefined }
        : { staffId: input.staffId ?? undefined }),
      payPeriod: {
        payDate: { gte: yearStart, lte: yearEnd },
      },
    },
    select: {
      grossPay: true,
      deductions: true,
      netPay: true,
      deductionsItems: {
        where: { employeePaid: true },
        select: { label: true, amount: true },
      },
    },
  })
  if (prior.length === 0) return null

  const byLabelMap = new Map<string, number>()
  for (const p of prior) {
    for (const d of p.deductionsItems) {
      const label = d.label.trim() || 'Other deduction'
      byLabelMap.set(label, round2((byLabelMap.get(label) ?? 0) + Number(d.amount)))
    }
  }

  return {
    gross: round2(prior.reduce((s, p) => s + Number(p.grossPay), 0)),
    deductions: round2(prior.reduce((s, p) => s + Number(p.deductions), 0)),
    net: round2(prior.reduce((s, p) => s + Number(p.netPay), 0)),
    byLabel: [...byLabelMap.entries()].map(([label, amount]) => ({ label, amount })),
  }
}

/** If RBT statement has no itemized deductions, copy amounts from a matching legacy published entry. */
async function ensureRbtDeductionsFromLegacy(
  statementId: string,
  staffId: string
) {
  const existing = await prisma.payDeduction.count({
    where: { payStatementId: statementId },
  })
  if (existing > 0) return

  const statement = await prisma.payStatement.findUnique({
    where: { id: statementId },
    include: { payPeriod: true },
  })
  if (!statement) return

  const legacy = await prisma.payrollRunEntry.findFirst({
    where: {
      rbtProfileId: staffId,
      payrollRun: {
        status: 'PUBLISHED',
        periodStart: statement.payPeriod.startDate,
        periodEnd: statement.payPeriod.endDate,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!legacy) return

  const rows = deductionsFromLegacyPayrollEntry({
    empTaxFIT: legacy.empTaxFIT,
    empTaxSS: legacy.empTaxSS,
    empTaxMed: legacy.empTaxMed,
    empTaxNYIT: legacy.empTaxNYIT,
  })
  if (rows.length === 0) return
  await replacePayDeductions({ payStatementId: statementId, deductions: rows })
}

/**
 * Ensure W-2 statements have tax rows before PDF:
 * - RBT: always W-2 (legacy register first, then estimate)
 * - BCBA W-2: estimate when empty
 * - BCBA 1099: clear any leftover tax rows
 */
async function ensureClassificationDeductions(input: {
  statementId: string
  payeeType: 'BCBA' | 'RBT'
  classification: PayeeClassification
  staffId: string | null
  grossPay: number
}): Promise<void> {
  if (input.classification === '1099') {
    const count = await prisma.payDeduction.count({
      where: { payStatementId: input.statementId },
    })
    if (count > 0) {
      await replacePayDeductions({
        payStatementId: input.statementId,
        deductions: [],
      })
    }
    return
  }

  if (input.payeeType === 'RBT' && input.staffId) {
    await ensureRbtDeductionsFromLegacy(input.statementId, input.staffId)
  }

  const existing = await prisma.payDeduction.count({
    where: { payStatementId: input.statementId },
  })
  if (existing > 0) return

  const estimated = estimateW2EmployeeDeductions(input.grossPay)
  if (estimated.length === 0) return
  await replacePayDeductions({
    payStatementId: input.statementId,
    deductions: estimated,
  })
}

export async function generatePayStubPdf(input: {
  payStatementId: string
  actorUserId: string
}): Promise<{ pdfUrl: string; status: 'READY' }> {
  let statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
    include: {
      payPeriod: true,
      lineItems: { orderBy: [{ workDate: 'asc' }, { startClock: 'asc' }] },
      deductionsItems: { orderBy: { createdAt: 'asc' } },
      contractor: { include: { activeRate: true } },
      rbtProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          hourlyPayRate: true,
        },
      },
    },
  })
  if (!statement) throw new Error('Pay statement not found')
  if (statement.status === 'SENT') {
    throw new Error('Cannot regenerate a sent pay statement')
  }
  if (statement.lineItems.length === 0) {
    throw new Error('Add line items before generating a stub')
  }
  const payableGross = round2(
    statement.lineItems.reduce((s, li) => s + Number(li.amount), 0)
  )
  if (!(payableGross > 0)) {
    throw new Error(
      'No payable hours on this statement (scheduled-only sessions are not paid)'
    )
  }

  const classification: PayeeClassification =
    statement.payeeType === 'RBT'
      ? 'W2'
      : normalizePayeeClassification(statement.contractor?.classification)

  await ensureClassificationDeductions({
    statementId: statement.id,
    payeeType: statement.payeeType,
    classification,
    staffId: statement.staffId,
    grossPay: payableGross,
  })

  statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
    include: {
      payPeriod: true,
      lineItems: { orderBy: [{ workDate: 'asc' }, { startClock: 'asc' }] },
      deductionsItems: { orderBy: { createdAt: 'asc' } },
      contractor: { include: { activeRate: true } },
      rbtProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          hourlyPayRate: true,
        },
      },
    },
  })
  if (!statement) throw new Error('Pay statement not found')

  let legalName: string
  let entityName: string | null
  let ratePerHour: number | null
  let payeeKey: string

  if (statement.payeeType === 'BCBA') {
    if (!statement.contractor) throw new Error('Contractor profile missing')
    legalName = statement.contractor.legalName
    entityName = statement.contractor.entityName
    ratePerHour = statement.contractor.activeRate
      ? Number(statement.contractor.activeRate.ratePerHour)
      : await getActiveContractorRate(statement.contractor.id)
    payeeKey = statement.contractorId ?? statement.contractor.id
  } else {
    if (!statement.rbtProfile) throw new Error('RBT profile missing')
    legalName = `${statement.rbtProfile.firstName} ${statement.rbtProfile.lastName}`.trim()
    entityName = null
    ratePerHour = statement.rbtProfile.hourlyPayRate
    payeeKey = statement.staffId ?? statement.rbtProfile.id
  }

  const deductionRows = statement.deductionsItems.map((d) => ({
    label: d.label,
    amount: Number(d.amount),
    employeePaid: d.employeePaid,
  }))
  const employeeDeductionSum = round2(
    deductionRows
      .filter((d) => d.employeePaid)
      .reduce((s, d) => s + d.amount, 0)
  )

  const ytdBase = await loadYtdForPayee({
    payeeType: statement.payeeType,
    contractorId: statement.contractorId,
    staffId: statement.staffId,
    payDate: statement.payPeriod.payDate,
    excludeStatementId: statement.id,
  })
  const showYtd = classification === 'W2'
  const ytd = showYtd
    ? ytdBase
      ? {
          gross: round2(ytdBase.gross + Number(statement.grossPay)),
          deductions: round2(
            ytdBase.deductions +
              (deductionRows.length > 0
                ? employeeDeductionSum
                : Number(statement.deductions))
          ),
          net: round2(
            ytdBase.net +
              Number(statement.grossPay) -
              (deductionRows.length > 0
                ? employeeDeductionSum
                : Number(statement.deductions))
          ),
          byLabel: (() => {
            const map = new Map(
              ytdBase.byLabel.map((r) => [r.label, r.amount] as const)
            )
            for (const d of deductionRows.filter((r) => r.employeePaid)) {
              map.set(d.label, round2((map.get(d.label) ?? 0) + d.amount))
            }
            return [...map.entries()].map(([label, amount]) => ({
              label,
              amount,
            }))
          })(),
        }
      : {
          gross: Number(statement.grossPay),
          deductions:
            deductionRows.length > 0
              ? employeeDeductionSum
              : Number(statement.deductions),
          net: Number(statement.netPay),
          byLabel: deductionRows
            .filter((d) => d.employeePaid)
            .map((d) => ({ label: d.label, amount: d.amount })),
        }
    : null

  const pdfBytes = await renderPayStubPdf({
    payeeType: statement.payeeType,
    classification,
    legalName,
    entityName,
    payDate: statement.payPeriod.payDate,
    periodStart: statement.payPeriod.startDate,
    periodEnd: statement.payPeriod.endDate,
    ratePerHour,
    deductions:
      deductionRows.length > 0
        ? employeeDeductionSum
        : Number(statement.deductions),
    deductionRows,
    reconciled: statement.reconciled,
    ytd,
    lineItems: statement.lineItems.map((li) => ({
      workDate: li.workDate,
      startClock: li.startClock,
      endClock: li.endClock,
      hours: Number(li.hours),
      amount: Number(li.amount),
    })),
  })

  const storagePath = buildPayStubStoragePath({
    statementId: statement.id,
    payeeType: statement.payeeType,
    payeeKey,
  })
  await uploadPayStubPdf({ storagePath, bytes: pdfBytes })

  await prisma.payStatement.update({
    where: { id: statement.id },
    data: {
      pdfUrl: storagePath,
      status: 'READY',
    },
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: statement.id,
    label: `PAY_STATEMENT_EDIT:generate_stub:${statement.payeeType}:${classification}`,
    after: { pdfUrl: storagePath, status: 'READY', classification },
  })

  return { pdfUrl: storagePath, status: 'READY' }
}

export async function sendPayStatement(input: {
  payStatementId: string
  actorUserId: string
}): Promise<{ status: 'SENT'; sentAt: Date }> {
  const statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
  })
  if (!statement) throw new Error('Pay statement not found')
  if (!statement.pdfUrl) {
    throw new Error('Generate the stub PDF before sending')
  }
  if (statement.status === 'SENT') {
    return { status: 'SENT', sentAt: statement.sentAt ?? new Date() }
  }

  const sentAt = new Date()
  await prisma.payStatement.update({
    where: { id: statement.id },
    data: { status: 'SENT', sentAt },
  })

  await auditPayrollChange({
    actorUserId: input.actorUserId,
    entityType: 'PayStatement',
    entityId: statement.id,
    label: `PAY_STATEMENT_EDIT:status:${statement.status}→SENT`,
    before: { status: statement.status },
    after: { status: 'SENT', sentAt: sentAt.toISOString() },
  })

  revalidatePath('/portal/pay')
  revalidatePath('/rbt/sessions')

  return { status: 'SENT', sentAt }
}
