import 'server-only'

import { prisma } from '@/lib/prisma'
import { auditPayrollChange } from '@/lib/payroll/access'
import { renderPayStubPdf } from '@/lib/payroll/renderPayStubPdf'
import {
  buildPayStubStoragePath,
  uploadPayStubPdf,
} from '@/lib/payroll/payStubStorage'
import { getActiveContractorRate } from '@/lib/payroll/contractors'

export async function generatePayStubPdf(input: {
  payStatementId: string
  actorUserId: string
}): Promise<{ pdfUrl: string; status: 'READY' }> {
  const statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
    include: {
      payPeriod: true,
      lineItems: { orderBy: [{ workDate: 'asc' }, { startClock: 'asc' }] },
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

  const pdfBytes = await renderPayStubPdf({
    payeeType: statement.payeeType,
    legalName,
    entityName,
    payDate: statement.payPeriod.payDate,
    periodStart: statement.payPeriod.startDate,
    periodEnd: statement.payPeriod.endDate,
    ratePerHour,
    deductions: Number(statement.deductions),
    reconciled: statement.reconciled,
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
    label: `PAY_STATEMENT_EDIT:generate_stub:${statement.payeeType}`,
    after: { pdfUrl: storagePath, status: 'READY' },
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

  return { status: 'SENT', sentAt }
}
