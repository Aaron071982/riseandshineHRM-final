import type { BillingMatchStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { matchProviderToRbt, computeEntryPay } from './matcher'
import { loadRbtMatchCandidates, suggestPayRatesForRbts } from './payRate'
import { loadPayrollOnlyCandidates } from './payrollOnly'

export function isPayableMatchStatus(status: BillingMatchStatus): boolean {
  return status === 'MATCHED' || status === 'PAYROLL_ONLY'
}

export async function rematchEntryFromProvider(entryId: string) {
  const entry = await prisma.billingEntry.findUnique({ where: { id: entryId } })
  if (!entry) throw new Error('Entry not found')

  const [candidates, payrollOnly] = await Promise.all([
    loadRbtMatchCandidates(),
    loadPayrollOnlyCandidates(),
  ])
  const suggestedRates = await suggestPayRatesForRbts(candidates.map((c) => c.id))

  const payrollMatch = payrollOnly.find((p) => p.artemisProviderName === entry.providerNameRaw)
  if (payrollMatch) {
    const hourlyRate = payrollMatch.hourlyPayRate
    const { grossPay, finalPay } = computeEntryPay(entry.totalHours, hourlyRate, entry.adjustment)
    return prisma.billingEntry.update({
      where: { id: entryId },
      data: {
        rbtProfileId: null,
        payrollOnlyId: payrollMatch.id,
        matchStatus: 'PAYROLL_ONLY',
        matchConfidence: 1,
        suggestedRbtProfileId: null,
        hourlyRate,
        grossPay,
        finalPay,
        isExcluded: false,
      },
      include: {
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
        payrollOnly: { select: { id: true, fullName: true, email: true, hourlyPayRate: true } },
      },
    })
  }

  const match = matchProviderToRbt(entry.providerNameRaw, candidates, suggestedRates)
  const hourlyRate = match.hourlyRate
  const { grossPay, finalPay } = computeEntryPay(entry.totalHours, hourlyRate, entry.adjustment)

  return prisma.billingEntry.update({
    where: { id: entryId },
    data: {
      rbtProfileId: match.rbtProfileId,
      payrollOnlyId: null,
      matchStatus: match.matchStatus,
      matchConfidence: match.matchConfidence,
      suggestedRbtProfileId: match.suggestedRbtProfileId,
      hourlyRate,
      grossPay,
      finalPay,
      isExcluded: false,
    },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      payrollOnly: { select: { id: true, fullName: true, email: true, hourlyPayRate: true } },
    },
  })
}

export async function matchEntryToRbt(entryId: string, rbtProfileId: string, actorEmail: string | null) {
  const entry = await prisma.billingEntry.findUnique({ where: { id: entryId } })
  if (!entry) throw new Error('Entry not found')

  const rbt = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { id: true, hourlyPayRate: true },
  })
  if (!rbt) throw new Error('RBT profile not found')

  const hourlyRate = rbt.hourlyPayRate
  const { grossPay, finalPay } = computeEntryPay(entry.totalHours, hourlyRate, entry.adjustment)

  await prisma.rBTProfile.updateMany({
    where: {
      artemisProviderName: entry.providerNameRaw,
      id: { not: rbt.id },
    },
    data: { artemisProviderName: null },
  })

  await prisma.rBTProfile.update({
    where: { id: rbt.id },
    data: {
      artemisProviderName: entry.providerNameRaw,
      ...(hourlyRate != null
        ? { payRateUpdatedAt: new Date(), payRateUpdatedBy: actorEmail }
        : {}),
    },
  })

  return prisma.billingEntry.update({
    where: { id: entryId },
    data: {
      rbtProfileId: rbt.id,
      payrollOnlyId: null,
      matchStatus: 'MATCHED',
      matchConfidence: 1,
      suggestedRbtProfileId: null,
      hourlyRate,
      grossPay,
      finalPay,
      isExcluded: false,
    },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      payrollOnly: { select: { id: true, fullName: true, email: true, hourlyPayRate: true } },
    },
  })
}

export async function matchEntryToPayrollOnly(
  entryId: string,
  opts: { payrollOnlyId?: string; fullName?: string; email?: string | null; hourlyPayRate?: number | null }
) {
  const entry = await prisma.billingEntry.findUnique({ where: { id: entryId } })
  if (!entry) throw new Error('Entry not found')

  let payrollOnlyId = opts.payrollOnlyId
  if (!payrollOnlyId) {
    const fullName = opts.fullName?.trim() || entry.providerNameRaw
    const person = await prisma.payrollOnlyPerson.upsert({
      where: { artemisProviderName: entry.providerNameRaw },
      create: {
        fullName,
        artemisProviderName: entry.providerNameRaw,
        email: opts.email ?? null,
        hourlyPayRate: opts.hourlyPayRate ?? null,
      },
      update: {
        fullName,
        ...(opts.email !== undefined ? { email: opts.email } : {}),
        ...(opts.hourlyPayRate !== undefined ? { hourlyPayRate: opts.hourlyPayRate } : {}),
      },
    })
    payrollOnlyId = person.id
  } else {
    await prisma.payrollOnlyPerson.update({
      where: { id: payrollOnlyId },
      data: { artemisProviderName: entry.providerNameRaw },
    })
  }

  const person = await prisma.payrollOnlyPerson.findUnique({ where: { id: payrollOnlyId } })
  const hourlyRate = opts.hourlyPayRate ?? person?.hourlyPayRate ?? null
  const { grossPay, finalPay } = computeEntryPay(entry.totalHours, hourlyRate, entry.adjustment)

  return prisma.billingEntry.update({
    where: { id: entryId },
    data: {
      rbtProfileId: null,
      payrollOnlyId,
      matchStatus: 'PAYROLL_ONLY',
      matchConfidence: 1,
      suggestedRbtProfileId: null,
      hourlyRate,
      grossPay,
      finalPay,
      isExcluded: false,
    },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      payrollOnly: { select: { id: true, fullName: true, email: true, hourlyPayRate: true } },
    },
  })
}

export async function excludeEntry(entryId: string, reason: string) {
  const entry = await prisma.billingEntry.findUnique({ where: { id: entryId } })
  if (!entry) throw new Error('Entry not found')

  const { grossPay, finalPay } = computeEntryPay(entry.totalHours, null, 0)

  return prisma.billingEntry.update({
    where: { id: entryId },
    data: {
      rbtProfileId: null,
      payrollOnlyId: null,
      matchStatus: 'IGNORED',
      isExcluded: true,
      notes: reason.trim() || 'Excluded from payroll',
      hourlyRate: null,
      grossPay,
      finalPay,
    },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
      payrollOnly: { select: { id: true, fullName: true, email: true, hourlyPayRate: true } },
    },
  })
}

export async function unmatchEntry(entryId: string) {
  const entry = await prisma.billingEntry.findUnique({ where: { id: entryId } })
  if (entry?.rbtProfileId) {
    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: entry.rbtProfileId },
      select: { artemisProviderName: true },
    })
    if (rbt?.artemisProviderName === entry.providerNameRaw) {
      await prisma.rBTProfile.update({
        where: { id: entry.rbtProfileId },
        data: { artemisProviderName: null },
      })
    }
  }
  return rematchEntryFromProvider(entryId)
}
