import { prisma } from '@/lib/prisma'

/** Mode of non-null assignment hourly rates for an RBT. */
export async function suggestPayRatesForRbts(
  rbtProfileIds: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  if (rbtProfileIds.length === 0) return result

  const assignments = await prisma.clientAssignment.findMany({
    where: {
      rbtProfileId: { in: rbtProfileIds },
      hourlyRate: { not: null },
    },
    select: { rbtProfileId: true, hourlyRate: true },
  })

  const byRbt = new Map<string, number[]>()
  for (const a of assignments) {
    if (a.hourlyRate == null) continue
    const rate = Number(a.hourlyRate)
    if (!byRbt.has(a.rbtProfileId)) byRbt.set(a.rbtProfileId, [])
    byRbt.get(a.rbtProfileId)!.push(rate)
  }

  for (const id of rbtProfileIds) {
    const rates = byRbt.get(id)
    if (!rates || rates.length === 0) {
      result.set(id, null)
      continue
    }
    const counts = new Map<number, number>()
    for (const r of rates) {
      counts.set(r, (counts.get(r) ?? 0) + 1)
    }
    let bestRate = rates[0]
    let bestCount = 0
    for (const [rate, count] of counts) {
      if (count > bestCount) {
        bestCount = count
        bestRate = rate
      }
    }
    result.set(id, bestRate)
  }

  return result
}

export async function loadRbtMatchCandidates(): Promise<
  Array<{
    id: string
    firstName: string
    lastName: string
    artemisProviderName: string | null
    hourlyPayRate: number | null
  }>
> {
  const profiles = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      artemisProviderName: true,
      hourlyPayRate: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return profiles
}
