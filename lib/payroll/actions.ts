'use server'

import { revalidatePath } from 'next/cache'
import {
  assertCanWritePayroll,
  auditPayrollChange,
  PayrollAccessError,
} from '@/lib/payroll/access'
import {
  setContractorPayRate,
  setRbtStaffPayRate,
  upsertContractorProfile,
} from '@/lib/payroll/contractors'
import {
  addBcbaManualLineItem,
  ensureBcbaPayStatement,
  listPayStatementLines,
  removePayLineItem,
  replaceBcbaManualLines,
  setPayStatementGrossOverride,
  setPayStatementStatus,
  upsertPayPeriod,
} from '@/lib/payroll/statements'
import { prisma } from '@/lib/prisma'
import { importRbtStatementsFromArtemisWorkbook } from '@/lib/payroll/rbtImport'
import {
  generatePayStubPdf,
  sendPayStatement,
} from '@/lib/payroll/generatePayStub'
import { replacePayDeductions } from '@/lib/payroll/deductions'
import type { DeductionCode } from '@prisma/client'
import type { PayStatementStatus } from '@prisma/client'

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status?: number }

function fail(err: unknown): ActionResult {
  if (err instanceof PayrollAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[payroll]', err)
  return {
    ok: false,
    error: err instanceof Error ? err.message : 'Something went wrong',
  }
}

function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`)
  return d
}

export async function createOrUpdateContractorAction(input: {
  userId: string
  legalName: string
  entityName?: string | null
}): Promise<ActionResult<{ contractorId: string }>> {
  try {
    const actor = await assertCanWritePayroll()
    const user = await prisma.user.findUnique({
      where: { id: input.userId.trim() },
      select: { id: true },
    })
    if (!user) {
      return {
        ok: false,
        error: 'User not found — pick a BCBA from the hours sheet list',
      }
    }
    const c = await upsertContractorProfile({
      ...input,
      userId: user.id,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, contractorId: c.id }
  } catch (err) {
    return fail(err) as ActionResult<{ contractorId: string }>
  }
}

export async function setContractorRateAction(input: {
  contractorId: string
  ratePerHour: number
  effectiveFrom?: string
}): Promise<ActionResult<{ rateId: string; ratePerHour: number }>> {
  try {
    const actor = await assertCanWritePayroll()
    const rate = await setContractorPayRate({
      contractorId: input.contractorId,
      ratePerHour: input.ratePerHour,
      effectiveFrom: input.effectiveFrom
        ? parseDateInput(input.effectiveFrom)
        : undefined,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, rateId: rate.id, ratePerHour: rate.ratePerHour }
  } catch (err) {
    return fail(err) as ActionResult<{ rateId: string; ratePerHour: number }>
  }
}

export async function setRbtRateAction(input: {
  staffId: string
  ratePerHour: number
}): Promise<ActionResult<{ rateId: string; ratePerHour: number }>> {
  try {
    const actor = await assertCanWritePayroll()
    const rate = await setRbtStaffPayRate({
      staffId: input.staffId,
      ratePerHour: input.ratePerHour,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, rateId: rate.id, ratePerHour: rate.ratePerHour }
  } catch (err) {
    return fail(err) as ActionResult<{ rateId: string; ratePerHour: number }>
  }
}

export async function upsertPayPeriodAction(input: {
  startDate: string
  endDate: string
  payDate: string
  label: string
}): Promise<ActionResult<{ payPeriodId: string }>> {
  try {
    await assertCanWritePayroll()
    const period = await upsertPayPeriod({
      startDate: parseDateInput(input.startDate),
      endDate: parseDateInput(input.endDate),
      payDate: parseDateInput(input.payDate),
      label: input.label.trim(),
    })
    revalidatePath('/billing')
    return { ok: true, payPeriodId: period.id }
  } catch (err) {
    return fail(err) as ActionResult<{ payPeriodId: string }>
  }
}

export async function ensureBcbaStatementAction(input: {
  payPeriodId: string
  contractorId: string
  ratePerHour?: number
}): Promise<ActionResult<{ statementId: string; ratePerHour: number }>> {
  try {
    const actor = await assertCanWritePayroll()
    const stmt = await ensureBcbaPayStatement({
      ...input,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, statementId: stmt.id, ratePerHour: stmt.ratePerHour }
  } catch (err) {
    return fail(err) as ActionResult<{ statementId: string; ratePerHour: number }>
  }
}

export async function addBcbaHoursLineAction(input: {
  payStatementId: string
  workDate: string
  startClock: string
  endClock: string
  ratePerHour?: number
}): Promise<
  ActionResult<{
    lineItemId: string
    hours: number
    amount: number
    reconciled: boolean
  }>
> {
  try {
    const actor = await assertCanWritePayroll()
    const line = await addBcbaManualLineItem({
      payStatementId: input.payStatementId,
      workDate: parseDateInput(input.workDate),
      startClock: input.startClock,
      endClock: input.endClock,
      ratePerHour: input.ratePerHour,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return {
      ok: true,
      lineItemId: line.id,
      hours: line.hours,
      amount: line.amount,
      reconciled: line.reconciled,
    }
  } catch (err) {
    return fail(err) as ActionResult<{
      lineItemId: string
      hours: number
      amount: number
      reconciled: boolean
    }>
  }
}

/** Save a full BCBA hours sheet for one contractor in a pay period. */
export async function saveBcbaHoursSheetAction(input: {
  payPeriodId: string
  userId: string
  legalName: string
  entityName?: string | null
  /** 1099 contractor vs W-2 employee (taxes withheld on stub). */
  classification?: '1099' | 'W2'
  ratePerHour: number
  lines: { workDate: string; startClock: string; endClock: string }[]
}): Promise<
  ActionResult<{
    statementId: string
    contractorId: string
    lineCount: number
    totalHours: number
    grossPay: number
  }>
> {
  try {
    const actor = await assertCanWritePayroll()
    const user = await prisma.user.findUnique({
      where: { id: input.userId.trim() },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return { ok: false, error: 'Select a BCBA with a portal login (user not found)' }
    }

    const contractor = await upsertContractorProfile({
      userId: user.id,
      legalName: input.legalName.trim() || user.name || user.email || 'BCBA',
      entityName: input.entityName?.trim() || null,
      classification: input.classification ?? '1099',
      actorUserId: actor.id,
    })

    if (!(input.ratePerHour > 0)) {
      return { ok: false, error: 'Set a rate per hour before saving hours' }
    }

    await setContractorPayRate({
      contractorId: contractor.id,
      ratePerHour: input.ratePerHour,
      actorUserId: actor.id,
    })

    const stmt = await ensureBcbaPayStatement({
      payPeriodId: input.payPeriodId,
      contractorId: contractor.id,
      ratePerHour: input.ratePerHour,
      actorUserId: actor.id,
    })

    const filled = input.lines.filter(
      (l) => l.workDate && l.startClock.trim() && l.endClock.trim()
    )
    if (filled.length === 0) {
      return { ok: false, error: 'Add at least one day with start and end times' }
    }

    const replaced = await replaceBcbaManualLines({
      payStatementId: stmt.id,
      lines: filled.map((l) => ({
        workDate: parseDateInput(l.workDate),
        startClock: l.startClock,
        endClock: l.endClock,
      })),
      ratePerHour: input.ratePerHour,
      actorUserId: actor.id,
    })

    revalidatePath('/billing')
    return {
      ok: true,
      statementId: stmt.id,
      contractorId: contractor.id,
      lineCount: replaced.lineCount,
      totalHours: replaced.totalHours,
      grossPay: replaced.grossPay,
    }
  } catch (err) {
    return fail(err) as ActionResult<{
      statementId: string
      contractorId: string
      lineCount: number
      totalHours: number
      grossPay: number
    }>
  }
}

export async function getPayStatementLinesAction(input: {
  payStatementId: string
}): Promise<
  ActionResult<{
    lines: Awaited<ReturnType<typeof listPayStatementLines>>
  }>
> {
  try {
    await assertCanWritePayroll()
    const lines = await listPayStatementLines(input.payStatementId)
    return { ok: true, lines }
  } catch (err) {
    return fail(err) as ActionResult<{
      lines: Awaited<ReturnType<typeof listPayStatementLines>>
    }>
  }
}

/** Generate stub PDFs for every statement in a period that has hours (optional payee filter). */
export async function generateAllPayStubsForPeriodAction(input: {
  payPeriodId: string
  payeeType?: 'BCBA' | 'RBT'
}): Promise<
  ActionResult<{
    generated: number
    skipped: number
    errors: { statementId: string; name: string; error: string }[]
  }>
> {
  try {
    const actor = await assertCanWritePayroll()
    const statements = await prisma.payStatement.findMany({
      where: {
        payPeriodId: input.payPeriodId,
        ...(input.payeeType ? { payeeType: input.payeeType } : {}),
      },
      include: {
        contractor: { select: { legalName: true } },
        rbtProfile: { select: { firstName: true, lastName: true } },
        _count: { select: { lineItems: true } },
      },
    })

    let generated = 0
    let skipped = 0
    const errors: { statementId: string; name: string; error: string }[] = []

    for (const s of statements) {
      const name =
        s.payeeType === 'BCBA'
          ? s.contractor?.legalName ?? 'BCBA'
          : s.rbtProfile
            ? `${s.rbtProfile.firstName} ${s.rbtProfile.lastName}`
            : 'RBT'
      if (s.status === 'SENT') {
        skipped++
        continue
      }
      if (s._count.lineItems === 0 || !(Number(s.grossPay) > 0)) {
        skipped++
        continue
      }
      try {
        await generatePayStubPdf({
          payStatementId: s.id,
          actorUserId: actor.id,
        })
        generated++
      } catch (err) {
        errors.push({
          statementId: s.id,
          name,
          error: err instanceof Error ? err.message : 'Failed',
        })
      }
    }

    revalidatePath('/billing')
    revalidatePath('/portal/pay')
    return { ok: true, generated, skipped, errors }
  } catch (err) {
    return fail(err) as ActionResult<{
      generated: number
      skipped: number
      errors: { statementId: string; name: string; error: string }[]
    }>
  }
}

/** Publish stubs to the portal (BCBA) / mark Sent. Generates PDF first when missing. */
export async function sendAllPayStubsForPeriodAction(input: {
  payPeriodId: string
  payeeType?: 'BCBA' | 'RBT'
}): Promise<
  ActionResult<{
    sent: number
    skipped: number
    errors: { statementId: string; name: string; error: string }[]
  }>
> {
  try {
    const actor = await assertCanWritePayroll()
    const statements = await prisma.payStatement.findMany({
      where: {
        payPeriodId: input.payPeriodId,
        ...(input.payeeType ? { payeeType: input.payeeType } : {}),
      },
      include: {
        contractor: { select: { legalName: true } },
        rbtProfile: { select: { firstName: true, lastName: true } },
        _count: { select: { lineItems: true } },
      },
    })

    let sent = 0
    let skipped = 0
    const errors: { statementId: string; name: string; error: string }[] = []

    for (const s of statements) {
      const name =
        s.payeeType === 'BCBA'
          ? s.contractor?.legalName ?? 'BCBA'
          : s.rbtProfile
            ? `${s.rbtProfile.firstName} ${s.rbtProfile.lastName}`
            : 'RBT'
      if (s.status === 'SENT') {
        skipped++
        continue
      }
      if (s._count.lineItems === 0 || !(Number(s.grossPay) > 0)) {
        skipped++
        continue
      }
      try {
        if (!s.pdfUrl || s.status === 'DRAFT') {
          await generatePayStubPdf({
            payStatementId: s.id,
            actorUserId: actor.id,
          })
        }
        await sendPayStatement({
          payStatementId: s.id,
          actorUserId: actor.id,
        })
        sent++
      } catch (err) {
        errors.push({
          statementId: s.id,
          name,
          error: err instanceof Error ? err.message : 'Failed',
        })
      }
    }

    revalidatePath('/billing')
    revalidatePath('/portal/pay')
    return { ok: true, sent, skipped, errors }
  } catch (err) {
    return fail(err) as ActionResult<{
      sent: number
      skipped: number
      errors: { statementId: string; name: string; error: string }[]
    }>
  }
}

export async function removePayLineItemAction(input: {
  lineItemId: string
}): Promise<ActionResult<{ reconciled: boolean }>> {
  try {
    const actor = await assertCanWritePayroll()
    const res = await removePayLineItem({
      lineItemId: input.lineItemId,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, reconciled: res.reconciled }
  } catch (err) {
    return fail(err) as ActionResult<{ reconciled: boolean }>
  }
}

export async function setGrossOverrideAction(input: {
  payStatementId: string
  grossOverride: number | null
}): Promise<ActionResult<{ reconciled: boolean; grossPay: number }>> {
  try {
    const actor = await assertCanWritePayroll()
    const res = await setPayStatementGrossOverride({
      ...input,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, reconciled: res.reconciled, grossPay: res.grossPay }
  } catch (err) {
    return fail(err) as ActionResult<{ reconciled: boolean; grossPay: number }>
  }
}

export async function setPayStatementStatusAction(input: {
  payStatementId: string
  status: PayStatementStatus
}): Promise<ActionResult> {
  try {
    const actor = await assertCanWritePayroll()
    await setPayStatementStatus({
      ...input,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}


export async function setPayDeductionsAction(input: {
  payStatementId: string
  deductions: {
    code: DeductionCode
    label: string
    amount: number
    employeePaid?: boolean
  }[]
}): Promise<ActionResult<{ deductions: number; netPay: number; reconciled: boolean }>> {
  try {
    const actor = await assertCanWritePayroll()
    const res = await replacePayDeductions({
      payStatementId: input.payStatementId,
      deductions: input.deductions,
    })
    await auditPayrollChange({
      actorUserId: actor.id,
      entityType: 'PayStatement',
      entityId: input.payStatementId,
      label: 'PAY_STATEMENT_EDIT:set_deductions',
      after: res,
    })
    revalidatePath('/billing')
    return { ok: true, ...res }
  } catch (err) {
    return fail(err) as ActionResult<{
      deductions: number
      netPay: number
      reconciled: boolean
    }>
  }
}

export async function generatePayStubAction(input: {
  payStatementId: string
}): Promise<ActionResult<{ pdfUrl: string; status: 'READY' }>> {
  try {
    const actor = await assertCanWritePayroll()
    const res = await generatePayStubPdf({
      payStatementId: input.payStatementId,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    revalidatePath('/portal/pay')
    revalidatePath('/rbt/sessions')
    return { ok: true, ...res }
  } catch (err) {
    return fail(err) as ActionResult<{ pdfUrl: string; status: 'READY' }>
  }
}

export async function sendPayStubAction(input: {
  payStatementId: string
}): Promise<ActionResult<{ status: 'SENT'; sentAt: string }>> {
  try {
    const actor = await assertCanWritePayroll()
    const res = await sendPayStatement({
      payStatementId: input.payStatementId,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    revalidatePath('/portal/pay')
    revalidatePath('/rbt/sessions')
    return {
      ok: true,
      status: res.status,
      sentAt: res.sentAt.toISOString(),
    }
  } catch (err) {
    return fail(err) as ActionResult<{ status: 'SENT'; sentAt: string }>
  }
}

/**
 * Import RBT statements from an Artemis Session Reconciliation .xlsx
 * (base64-encoded for server action transport).
 */
export async function importRbtFromArtemisAction(input: {
  payPeriodId: string
  workbookBase64: string
}): Promise<
  ActionResult<{
    statementsCreated: number
    statementsUpdated: number
    lineItemsCreated: number
    unmatchedProviders: string[]
    statementIds: string[]
  }>
> {
  try {
    const actor = await assertCanWritePayroll()
    const buffer = Buffer.from(input.workbookBase64, 'base64')
    const result = await importRbtStatementsFromArtemisWorkbook({
      payPeriodId: input.payPeriodId,
      workbookBuffer: buffer,
      actorUserId: actor.id,
    })
    revalidatePath('/billing')
    return { ok: true, ...result }
  } catch (err) {
    return fail(err) as ActionResult<{
      statementsCreated: number
      statementsUpdated: number
      lineItemsCreated: number
      unmatchedProviders: string[]
      statementIds: string[]
    }>
  }
}
