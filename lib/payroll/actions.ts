'use server'

import { revalidatePath } from 'next/cache'
import {
  assertCanWritePayroll,
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
  removePayLineItem,
  setPayStatementGrossOverride,
  setPayStatementStatus,
  upsertPayPeriod,
} from '@/lib/payroll/statements'
import { importRbtStatementsFromArtemisWorkbook } from '@/lib/payroll/rbtImport'
import {
  generatePayStubPdf,
  sendPayStatement,
} from '@/lib/payroll/generatePayStub'
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
    const c = await upsertContractorProfile({
      ...input,
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
