import { prisma } from '@/lib/prisma'
import { matchProviderToRbt } from '@/lib/billing/matcher'
import { loadRbtMatchCandidates } from '@/lib/billing/payRate'
import type { MatchResult } from '@/lib/billing/types'
import type { DerivedProviderSchedule, ScheduleDeriveResult } from './deriveWeekly'
import { CLIENT_BOROUGH_OPTIONS } from './boroughOptions'

export { CLIENT_BOROUGH_OPTIONS }
export type { ClientBoroughOption } from './boroughOptions'

export type ProviderMatchPreview = {
  providerName: string
  role: string
  slotCount: number
  slots: DerivedProviderSchedule['slots']
  match: MatchResult
}

export type ScheduleImportPreview = {
  providers: ProviderMatchPreview[]
  clientNames: string[]
  clientBoroughs: Record<string, string>
  unsetClientCount: number
  detectedDateRange: { min: string | null; max: string | null }
  stats: ScheduleDeriveResult['stats']
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function buildScheduleImportPreview(
  derived: ScheduleDeriveResult
): Promise<ScheduleImportPreview> {
  const candidates = await loadRbtMatchCandidates()
  const emptyRates = new Map<string, number | null>()

  const providers: ProviderMatchPreview[] = derived.providers.map((p) => ({
    providerName: p.providerName,
    role: p.role,
    slotCount: p.slots.length,
    slots: p.slots,
    match: matchProviderToRbt(p.providerName, candidates, emptyRates),
  }))

  const existing = await prisma.clientBorough.findMany({
    where: { clientName: { in: derived.clientNames } },
    select: { clientName: true, borough: true },
  })
  const boroughMap = new Map(existing.map((e) => [e.clientName, e.borough]))

  const clientBoroughs: Record<string, string> = {}
  let unsetClientCount = 0
  for (const name of derived.clientNames) {
    const b = boroughMap.get(name) ?? 'Unset'
    clientBoroughs[name] = b
    if (b === 'Unset' || !b) unsetClientCount++
  }

  return {
    providers,
    clientNames: derived.clientNames,
    clientBoroughs,
    unsetClientCount,
    detectedDateRange: {
      min: toIsoDate(derived.detectedDateRange.min),
      max: toIsoDate(derived.detectedDateRange.max),
    },
    stats: derived.stats,
  }
}

export type CommitScheduleImportInput = {
  fileName: string
  periodStart: Date
  periodEnd: Date
  mode: 'REPLACE' | 'MERGE'
  /** providerName → confirmed rbtProfileId (only matched providers) */
  confirmedMatches: Record<string, string>
  /** clientName → borough */
  clientBoroughs: Record<string, string>
  derived: ScheduleDeriveResult
  importedById: string
}

export type CommitScheduleImportResult = {
  batchId: string
  providerCount: number
  slotCount: number
  manualPreserved: number
  unsetClientCount: number
}

export async function commitScheduleImport(
  input: CommitScheduleImportInput
): Promise<CommitScheduleImportResult> {
  const {
    fileName,
    periodStart,
    periodEnd,
    mode,
    confirmedMatches,
    clientBoroughs,
    derived,
    importedById,
  } = input

  // Persist remembered boroughs + artemis mappings
  for (const [clientName, borough] of Object.entries(clientBoroughs)) {
    const b = (borough || 'Unset').trim() || 'Unset'
    await prisma.clientBorough.upsert({
      where: { clientName },
      create: { clientName, borough: b, updatedById: importedById },
      update: { borough: b, updatedById: importedById },
    })
  }

  for (const [providerName, rbtProfileId] of Object.entries(confirmedMatches)) {
    await prisma.rBTProfile.update({
      where: { id: rbtProfileId },
      data: { artemisProviderName: providerName },
    })
  }

  const matchedProviders = derived.providers.filter((p) => confirmedMatches[p.providerName])
  const rbtIds = [...new Set(Object.values(confirmedMatches))]

  // Count MANUAL rows that will be preserved for this period
  const manualPreserved = await prisma.rbtScheduleAssignment.count({
    where: {
      isActive: true,
      source: 'MANUAL',
      OR: [
        { periodStart, periodEnd },
        { periodStart: null, periodEnd: null },
      ],
      rbtProfileId: { in: rbtIds.length ? rbtIds : ['__none__'] },
    },
  })

  const batch = await prisma.scheduleImportBatch.create({
    data: {
      fileName,
      periodStart,
      periodEnd,
      importedById,
      providerCount: matchedProviders.length,
      slotCount: 0,
      mode,
    },
  })

  if (mode === 'REPLACE' && rbtIds.length > 0) {
    // Soft-deactivate prior Artemis imports for this period (never touch MANUAL)
    await prisma.rbtScheduleAssignment.updateMany({
      where: {
        source: 'ARTEMIS_IMPORT',
        isActive: true,
        periodStart,
        periodEnd,
        rbtProfileId: { in: rbtIds },
      },
      data: { isActive: false },
    })
  }

  let slotCount = 0
  for (const provider of matchedProviders) {
    const rbtProfileId = confirmedMatches[provider.providerName]
    if (!rbtProfileId) continue

    for (const slot of provider.slots) {
      const clientBorough = clientBoroughs[slot.clientName] || 'Unset'

      if (mode === 'MERGE') {
        const existing = await prisma.rbtScheduleAssignment.findFirst({
          where: {
            rbtProfileId,
            source: 'ARTEMIS_IMPORT',
            isActive: true,
            periodStart,
            periodEnd,
            clientName: slot.clientName,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
        if (existing) {
          await prisma.rbtScheduleAssignment.update({
            where: { id: existing.id },
            data: {
              clientBorough,
              importBatchId: batch.id,
            },
          })
          slotCount++
          continue
        }
      }

      await prisma.rbtScheduleAssignment.create({
        data: {
          rbtProfileId,
          clientName: slot.clientName,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          location: '12-Home',
          source: 'ARTEMIS_IMPORT',
          clientBorough,
          importBatchId: batch.id,
          periodStart,
          periodEnd,
          createdBy: importedById,
        },
      })
      slotCount++
    }
  }

  await prisma.scheduleImportBatch.update({
    where: { id: batch.id },
    data: { slotCount, providerCount: matchedProviders.length },
  })

  // Client Services Phase 2: re-link schedule names → service_clients (anti-decay)
  try {
    const { setClientSchedulePeriod } = await import('@/lib/client-services/schedulePeriod')
    await setClientSchedulePeriod(toIsoDate(periodStart)!, toIsoDate(periodEnd)!)
  } catch (err) {
    console.error('[schedule-import] client-services period sync failed:', err)
  }

  try {
    const { resolveScheduleClientLinks } = await import('@/lib/client-services/scheduleSync')
    const linkResult = await resolveScheduleClientLinks()
    console.info(
      '[schedule-import] client-services links:',
      linkResult.linked,
      'unmatched:',
      linkResult.unmatchedNames.length
    )
  } catch (err) {
    console.error('[schedule-import] client-services link resolve failed:', err)
  }

  const unsetClientCount = Object.values(clientBoroughs).filter(
    (b) => !b || b === 'Unset'
  ).length

  return {
    batchId: batch.id,
    providerCount: matchedProviders.length,
    slotCount,
    manualPreserved,
    unsetClientCount,
  }
}
