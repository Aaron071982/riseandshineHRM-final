import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { suggestPayRatesForRbts } from '@/lib/billing/payRate'
import { recomputeCycleTotals } from '@/lib/billing/totals'
import { recalculateCyclePayable } from '@/lib/billing/recalculatePayable'
import {
  matchEntryToRbt,
  matchEntryToPayrollOnly,
  excludeEntry,
  unmatchEntry,
} from '@/lib/billing/entryActions'
import { computeEntryPay } from '@/lib/billing/matcher'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const entry = await prisma.billingEntry.findUnique({
    where: { id: params.id },
    include: { billingCycle: true },
  })

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  if (entry.billingCycle.status === 'FINALIZED' || entry.billingCycle.status === 'PAID') {
    return NextResponse.json({ error: 'Cycle is locked' }, { status: 400 })
  }

  const body = await request.json()
  const actorEmail = auth.user.email ?? auth.user.id

  let updated

  if (body.action === 'unmatch') {
    updated = await unmatchEntry(params.id)
  } else if (body.action === 'exclude') {
    updated = await excludeEntry(params.id, String(body.reason ?? 'Excluded from payroll'))
  } else if (body.action === 'payroll_only') {
    updated = await matchEntryToPayrollOnly(params.id, {
      payrollOnlyId: body.payrollOnlyId,
      fullName: body.fullName,
      email: body.email,
      hourlyPayRate: body.hourlyPayRate != null ? Number(body.hourlyPayRate) : undefined,
    })
  } else if (body.rbtProfileId) {
    updated = await matchEntryToRbt(params.id, body.rbtProfileId, actorEmail)
  } else {
    const data: Record<string, unknown> = {}

    if (body.hourlyRate !== undefined) {
      const rate = body.hourlyRate === null || body.hourlyRate === '' ? null : Number(body.hourlyRate)
      data.hourlyRate = rate
      if (entry.rbtProfileId && rate != null) {
        await prisma.rBTProfile.update({
          where: { id: entry.rbtProfileId },
          data: {
            hourlyPayRate: rate,
            payRateUpdatedAt: new Date(),
            payRateUpdatedBy: actorEmail,
          },
        })
      }
      if (entry.payrollOnlyId && rate != null) {
        await prisma.payrollOnlyPerson.update({
          where: { id: entry.payrollOnlyId },
          data: { hourlyPayRate: rate },
        })
      }
    }

    if (body.adjustment !== undefined) {
      data.adjustment = Number(body.adjustment) || 0
    }
    if (body.adjustmentNote !== undefined) {
      data.adjustmentNote = body.adjustmentNote || null
    }
    if (body.notes !== undefined) {
      data.notes = body.notes || null
    }

    const hourlyRate =
      data.hourlyRate !== undefined ? (data.hourlyRate as number | null) : entry.hourlyRate
    const adjustment =
      data.adjustment !== undefined ? (data.adjustment as number) : entry.adjustment
    const { grossPay, finalPay } = computeEntryPay(entry.totalHours, hourlyRate, adjustment)
    data.grossPay = grossPay
    data.finalPay = finalPay

    updated = await prisma.billingEntry.update({
      where: { id: params.id },
      data,
      include: {
        rbtProfile: { select: { id: true, firstName: true, lastName: true, hourlyPayRate: true } },
        payrollOnly: { select: { id: true, fullName: true, email: true, hourlyPayRate: true } },
      },
    })
  }

  let suggestedHourlyRate: number | null = null
  const suggestId = updated.rbtProfileId ?? updated.suggestedRbtProfileId
  if (suggestId && updated.hourlyRate == null) {
    const map = await suggestPayRatesForRbts([suggestId])
    suggestedHourlyRate = map.get(suggestId) ?? null
  }

  await recalculateCyclePayable(entry.billingCycleId)

  return NextResponse.json({ entry: { ...updated, suggestedHourlyRate } })
}
