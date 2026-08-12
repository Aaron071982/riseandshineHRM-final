import { prisma } from '@/lib/prisma'
import { namesMatch, normalizeName } from '@/lib/rbt-schedule/from-roster'
import {
  getClientSchedulePeriod,
  schedulePeriodWhere,
  type ClientSchedulePeriod,
} from '@/lib/client-services/schedulePeriod'

export function serviceClientDisplayName(c: {
  firstName: string
  lastName: string
}): string {
  return `${c.firstName} ${c.lastName}`.trim()
}

/**
 * Best-match ServiceClient for a free-text Artemis schedule client name.
 * Returns null if ambiguous (multiple equally-good matches) or none.
 */
export function matchScheduleNameToClient(
  scheduleClientName: string,
  clients: { id: string; firstName: string; lastName: string }[]
): { id: string; confidence: 'exact' | 'fuzzy' } | null {
  const target = normalizeName(scheduleClientName)
  if (!target) return null

  const exact = clients.filter((c) => {
    const full = normalizeName(serviceClientDisplayName(c))
    const flipped = normalizeName(`${c.lastName} ${c.firstName}`)
    return full === target || flipped === target
  })
  if (exact.length === 1) return { id: exact[0].id, confidence: 'exact' }
  if (exact.length > 1) return null

  const fuzzy = clients.filter((c) =>
    namesMatch(scheduleClientName, serviceClientDisplayName(c))
  )
  if (fuzzy.length === 1) return { id: fuzzy[0].id, confidence: 'fuzzy' }

  // Strip Jr/Sr/II/III and middle initials: "MICHAEL A WHYTEJR" → Michael Whyte
  const stripped = normalizeName(
    scheduleClientName
      .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, ' ')
      .replace(/(jr|sr|ii|iii|iv)\.?$/i, ' ')
      .replace(/([a-z])(jr|sr)\b/gi, '$1 ')
      .replace(/\b([a-z])\b/gi, ' ')
  )
  if (stripped && stripped !== target) {
    const loose = clients.filter((c) => {
      const full = normalizeName(serviceClientDisplayName(c))
      const flipped = normalizeName(`${c.lastName} ${c.firstName}`)
      return (
        full === stripped ||
        flipped === stripped ||
        namesMatch(stripped, full) ||
        namesMatch(stripped, flipped)
      )
    })
    if (loose.length === 1) return { id: loose[0].id, confidence: 'fuzzy' }
  }

  return null
}

/**
 * Auto-link unlinked (or non-manual) schedule assignments to service_clients by name.
 * Called after biweekly Artemis import — anti-decay for schedule ↔ PHI linking.
 */
export async function resolveScheduleClientLinks(): Promise<{
  linked: number
  unmatchedNames: string[]
}> {
  const clients = await prisma.serviceClient.findMany({
    select: { id: true, firstName: true, lastName: true },
  })

  const names = await prisma.rbtScheduleAssignment.findMany({
    where: {
      isActive: true,
      OR: [{ serviceClientId: null }, { serviceClientLinkManual: false }],
    },
    select: { clientName: true },
    distinct: ['clientName'],
  })

  let linked = 0
  const unmatchedNames: string[] = []

  for (const { clientName } of names) {
    const match = matchScheduleNameToClient(clientName, clients)
    if (!match) {
      // Only flag names that have active assignments still unlinked
      const stillOpen = await prisma.rbtScheduleAssignment.count({
        where: {
          clientName,
          isActive: true,
          serviceClientId: null,
        },
      })
      if (stillOpen > 0) unmatchedNames.push(clientName)
      continue
    }

    const result = await prisma.rbtScheduleAssignment.updateMany({
      where: {
        clientName,
        isActive: true,
        serviceClientLinkManual: false,
      },
      data: { serviceClientId: match.id },
    })
    linked += result.count
  }

  return { linked, unmatchedNames: [...new Set(unmatchedNames)].sort() }
}

/** Manually link all active assignments with this schedule clientName → service client. */
export async function manualLinkScheduleName(
  scheduleClientName: string,
  serviceClientId: string
): Promise<number> {
  const result = await prisma.rbtScheduleAssignment.updateMany({
    where: { clientName: scheduleClientName, isActive: true },
    data: {
      serviceClientId,
      serviceClientLinkManual: true,
    },
  })
  return result.count
}

/** Unlink by schedule client name (clears link, marks non-manual so auto can retry). */
export async function manualUnlinkScheduleName(scheduleClientName: string): Promise<number> {
  const result = await prisma.rbtScheduleAssignment.updateMany({
    where: { clientName: scheduleClientName, isActive: true },
    data: {
      serviceClientId: null,
      serviceClientLinkManual: false,
    },
  })
  return result.count
}

/** Unlink a specific service client's schedule links. */
export async function unlinkServiceClientSchedule(serviceClientId: string): Promise<number> {
  const result = await prisma.rbtScheduleAssignment.updateMany({
    where: { serviceClientId },
    data: {
      serviceClientId: null,
      serviceClientLinkManual: false,
    },
  })
  return result.count
}

/** Unlinked schedule client names within the active Client Services period. */
export async function getUnlinkedScheduleClientNames(
  period?: ClientSchedulePeriod,
  opts?: { preferQuery?: string }
): Promise<{ clientName: string; assignmentCount: number }[]> {
  const activePeriod = period ?? (await getClientSchedulePeriod())
  const rows = await prisma.rbtScheduleAssignment.groupBy({
    by: ['clientName'],
    where: {
      ...schedulePeriodWhere(activePeriod),
      serviceClientId: null,
    },
    _count: { _all: true },
    orderBy: { clientName: 'asc' },
  })
  let list = rows.map((r) => ({
    clientName: r.clientName,
    assignmentCount: r._count._all,
  }))

  const q = (opts?.preferQuery ?? '').trim().toLowerCase()
  if (q) {
    const score = (name: string) => {
      const n = name.toLowerCase()
      if (n === q) return 0
      if (n.includes(q) || q.includes(n)) return 1
      const parts = q.split(/\s+/).filter(Boolean)
      if (parts.every((p) => n.includes(p))) return 2
      if (parts.some((p) => n.includes(p))) return 3
      return 9
    }
    list = [...list].sort((a, b) => {
      const sa = score(a.clientName)
      const sb = score(b.clientName)
      if (sa !== sb) return sa - sb
      return a.clientName.localeCompare(b.clientName)
    })
  }

  return list
}

/**
 * All distinct schedule client names in the period (for search / manual link).
 * Prefer unlinked; optionally include already-linked names for reassignment.
 */
export async function searchScheduleClientNames(
  period: ClientSchedulePeriod,
  query: string,
  opts?: { includeLinked?: boolean; limit?: number }
): Promise<{ clientName: string; assignmentCount: number; linked: boolean }[]> {
  const q = query.trim()
  const rows = await prisma.rbtScheduleAssignment.groupBy({
    by: ['clientName', 'serviceClientId'],
    where: {
      ...schedulePeriodWhere(period),
      ...(q
        ? { clientName: { contains: q, mode: 'insensitive' as const } }
        : {}),
      ...(opts?.includeLinked ? {} : { serviceClientId: null }),
    },
    _count: { _all: true },
    orderBy: { clientName: 'asc' },
  })

  const byName = new Map<string, { clientName: string; assignmentCount: number; linked: boolean }>()
  for (const r of rows) {
    const existing = byName.get(r.clientName)
    const linked = r.serviceClientId != null
    if (!existing) {
      byName.set(r.clientName, {
        clientName: r.clientName,
        assignmentCount: r._count._all,
        linked,
      })
    } else {
      existing.assignmentCount += r._count._all
      existing.linked = existing.linked || linked
    }
  }

  return [...byName.values()]
    .sort((a, b) => Number(a.linked) - Number(b.linked) || a.clientName.localeCompare(b.clientName))
    .slice(0, opts?.limit ?? 100)
}
