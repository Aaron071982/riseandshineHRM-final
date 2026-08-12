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

  // Sync weekly roster templates for /schedule compatibility (matched only).
  // Non-fatal: period assignments are the source of truth; roster is a mirror.
  try {
    await syncRosterFromImport(matchedProviders, confirmedMatches, clientBoroughs)
  } catch (err) {
    console.error('[schedule-import] roster sync failed (assignments saved):', err)
  }

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

/** Upsert therapists/clients/slots so classic roster views stay in sync with latest import. */
async function syncRosterFromImport(
  providers: DerivedProviderSchedule[],
  confirmedMatches: Record<string, string>,
  clientBoroughs: Record<string, string>
) {
  const dayEnum = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

  for (const provider of providers) {
    const rbtId = confirmedMatches[provider.providerName]
    if (!rbtId) continue
    const profile = await prisma.rBTProfile.findUnique({
      where: { id: rbtId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!profile) continue
    const name = `${profile.firstName} ${profile.lastName}`.trim()

    let therapist = await prisma.scheduleTherapist.findFirst({
      where: {
        OR: [
          ...(profile.email ? [{ email: profile.email }] : []),
          { name: { equals: name, mode: 'insensitive' as const } },
          { name: { equals: provider.providerName, mode: 'insensitive' as const } },
        ],
      },
    })
    if (!therapist) {
      therapist = await prisma.scheduleTherapist.create({
        data: {
          name: provider.providerName,
          email: profile.email,
          role: provider.role.toUpperCase() === 'BT' ? 'BT' : 'RBT',
          active: true,
        },
      })
    } else if (!therapist.email && profile.email) {
      await prisma.scheduleTherapist.update({
        where: { id: therapist.id },
        data: { email: profile.email },
      })
    }

    // Upsert by unique (therapistId, clientId, day, startMin) so existing roster
    // slots (including ones without note='Artemis import') don't fail the import.
    const importedKeys: { clientId: string; day: (typeof dayEnum)[number]; startMin: number }[] =
      []
    const seen = new Set<string>()

    for (const slot of provider.slots) {
      let client = await prisma.scheduleWeeklyClient.findFirst({
        where: { name: { equals: slot.clientName, mode: 'insensitive' } },
      })
      const borough = clientBoroughs[slot.clientName] || 'Unset'
      if (!client) {
        client = await prisma.scheduleWeeklyClient.create({
          data: {
            name: slot.clientName,
            borough: borough === 'Unset' ? null : borough,
            active: true,
          },
        })
      } else if (borough !== 'Unset' && client.borough !== borough) {
        await prisma.scheduleWeeklyClient.update({
          where: { id: client.id },
          data: { borough },
        })
      }

      const day = dayEnum[slot.dayOfWeek]
      const dedupeKey = `${client.id}|${day}|${slot.startMin}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      importedKeys.push({ clientId: client.id, day, startMin: slot.startMin })

      await prisma.scheduleSessionSlot.upsert({
        where: {
          therapistId_clientId_day_startMin: {
            therapistId: therapist.id,
            clientId: client.id,
            day,
            startMin: slot.startMin,
          },
        },
        create: {
          therapistId: therapist.id,
          clientId: client.id,
          day,
          startMin: slot.startMin,
          endMin: slot.endMin,
          status: 'CONFIRMED',
          procedureCode: '97153',
          placeOfService: '12-Home',
          note: 'Artemis import',
        },
        update: {
          endMin: slot.endMin,
          status: 'CONFIRMED',
          procedureCode: '97153',
          placeOfService: '12-Home',
          note: 'Artemis import',
        },
      })
    }

    // Drop stale Artemis-synced slots for this therapist that aren't in this import
    if (importedKeys.length > 0) {
      await prisma.scheduleSessionSlot.deleteMany({
        where: {
          therapistId: therapist.id,
          note: 'Artemis import',
          NOT: { OR: importedKeys },
        },
      })
    } else {
      await prisma.scheduleSessionSlot.deleteMany({
        where: { therapistId: therapist.id, note: 'Artemis import' },
      })
    }
  }
}
