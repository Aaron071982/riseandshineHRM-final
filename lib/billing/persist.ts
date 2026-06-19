import { prisma } from '@/lib/prisma'
import type { ArtemisParseResult, ProviderGroup } from './types'
import { matchProviderToRbt, computeEntryPay } from './matcher'
import { loadRbtMatchCandidates, suggestPayRatesForRbts } from './payRate'
import { loadPayrollOnlyCandidates } from './payrollOnly'
import { recomputeCycleTotals } from './totals'

async function createEntryWithSessions(
  cycleId: string,
  group: ProviderGroup,
  isExcluded: boolean,
  match: ReturnType<typeof matchProviderToRbt> | null,
  payrollOnlyId: string | null = null
) {
  const isPayrollOnly = !!payrollOnlyId
  const hourlyRate = isPayrollOnly
    ? match?.hourlyRate ?? null
    : match?.hourlyRate ?? null
  const adjustment = 0
  const { grossPay, finalPay } = computeEntryPay(group.totalHours, hourlyRate, adjustment)

  const entry = await prisma.billingEntry.create({
    data: {
      billingCycleId: cycleId,
      rbtProfileId: isPayrollOnly ? null : (match?.rbtProfileId ?? null),
      payrollOnlyId,
      providerNameRaw: group.providerName,
      matchStatus: isExcluded
        ? 'IGNORED'
        : isPayrollOnly
          ? 'PAYROLL_ONLY'
          : (match?.matchStatus ?? 'UNMATCHED'),
      matchConfidence: match?.matchConfidence ?? 0,
      suggestedRbtProfileId: match?.suggestedRbtProfileId ?? null,
      totalSessions: group.totalSessions,
      totalMinutes: group.totalMinutes,
      totalHours: group.totalHours,
      hourlyRate,
      grossPay,
      adjustment,
      finalPay,
      role: group.role,
      isExcluded,
      sessions: {
        create: group.sessions.map((s) => ({
          clientName: s.clientName,
          dos: s.dos.getTime() === 0 ? new Date() : s.dos,
          scheduledMinutes: s.scheduledMinutes,
          actualMinutes: s.actualMinutes,
          procedureCode: s.procedureCode,
          location: s.location,
          rawStatus: s.rawStatus,
        })),
      },
    },
    include: { sessions: true },
  })

  return {
    entry,
    suggestedHourlyRate: match?.suggestedHourlyRate ?? null,
  }
}

export async function persistArtemisParse(
  cycleId: string,
  parseResult: ArtemisParseResult,
  sourceFileName: string
) {
  await prisma.billingSession.deleteMany({
    where: { billingEntry: { billingCycleId: cycleId } },
  })
  await prisma.billingEntry.deleteMany({ where: { billingCycleId: cycleId } })

  const candidates = await loadRbtMatchCandidates()
  const payrollOnlyPeople = await loadPayrollOnlyCandidates()
  const candidateIds = candidates.map((c) => c.id)
  const suggestedRates = await suggestPayRatesForRbts(candidateIds)

  const payrollEntries = []
  for (const group of parseResult.payrollGroups) {
    const rememberedPayroll = payrollOnlyPeople.find(
      (p) => p.artemisProviderName === group.providerName
    )
    if (rememberedPayroll) {
      const match = {
        matchStatus: 'PAYROLL_ONLY' as const,
        matchConfidence: 1,
        rbtProfileId: null,
        suggestedRbtProfileId: null,
        hourlyRate: rememberedPayroll.hourlyPayRate,
        suggestedHourlyRate: null,
      }
      const result = await createEntryWithSessions(
        cycleId,
        group,
        false,
        match as ReturnType<typeof matchProviderToRbt>,
        rememberedPayroll.id
      )
      payrollEntries.push(result)
      continue
    }
    const match = matchProviderToRbt(group.providerName, candidates, suggestedRates)
    const result = await createEntryWithSessions(cycleId, group, false, match)
    payrollEntries.push(result)
  }

  const excludedEntries = []
  for (const group of parseResult.excludedGroups) {
    const result = await createEntryWithSessions(cycleId, group, true, null)
    excludedEntries.push(result)
  }

  await prisma.billingCycle.update({
    where: { id: cycleId },
    data: {
      status: 'REVIEW',
      sourceFileName,
    },
  })

  await recomputeCycleTotals(cycleId, 'preview')

  return {
    payrollEntries,
    excludedEntries,
    stats: parseResult.stats,
    detectedDateRange: parseResult.detectedDateRange,
  }
}
