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
  const name = scheduleClientName.trim()
  if (!name) return 0

  // Exact first
  let result = await prisma.rbtScheduleAssignment.updateMany({
    where: { clientName: name, isActive: true },
    data: {
      serviceClientId,
      serviceClientLinkManual: true,
    },
  })
  if (result.count > 0) return result.count

  // Case-insensitive fallback
  const matches = await prisma.rbtScheduleAssignment.findMany({
    where: { clientName: { equals: name, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  })
  if (matches.length === 0) return 0
  result = await prisma.rbtScheduleAssignment.updateMany({
    where: { id: { in: matches.map((m) => m.id) } },
    data: {
      serviceClientId,
      serviceClientLinkManual: true,
    },
  })
  return result.count
}

function parseHhMm(raw: string): string | null {
  const t = raw.trim()
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(t)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59) return null
  const ap = (m[3] || '').toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (!ap && (h > 23 || h < 0)) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

async function resolveRbtProfileId(btName: string): Promise<string | null> {
  const name = btName.trim()
  if (!name) return null
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]
    const last = parts.slice(1).join(' ')
    const byParts = await prisma.rBTProfile.findFirst({
      where: {
        status: { not: 'FIRED' },
        firstName: { equals: first, mode: 'insensitive' },
        lastName: { equals: last, mode: 'insensitive' },
      },
      select: { id: true },
    })
    if (byParts) return byParts.id
  }
  const all = await prisma.rBTProfile.findMany({
    where: { status: { not: 'FIRED' }, postHireStage: 'ACTIVE_DELIVERY' },
    select: { id: true, firstName: true, lastName: true },
    take: 500,
  })
  const target = normalizeName(name)
  const hit = all.find(
    (r) =>
      normalizeName(`${r.firstName} ${r.lastName}`) === target ||
      namesMatch(name, `${r.firstName} ${r.lastName}`)
  )
  return hit?.id ?? null
}

/**
 * Create MANUAL schedule rows for a service client (when Artemis name can't be linked).
 * days: JS weekday ints 0=Sun … 6=Sat (same as rbt_schedule_assignments.dayOfWeek).
 */
export async function createManualClientSessions(opts: {
  serviceClientId: string
  scheduleClientName: string
  btName: string
  days: number[]
  startTime: string
  endTime: string
  createdByUserId: string
  period?: ClientSchedulePeriod
}): Promise<{ created: number; scheduleClientName: string; rbtProfileId: string }> {
  const period = opts.period ?? (await getClientSchedulePeriod())
  const scheduleClientName = opts.scheduleClientName.trim()
  const startTime = parseHhMm(opts.startTime)
  const endTime = parseHhMm(opts.endTime)
  if (!scheduleClientName) throw new Error('scheduleClientName required')
  if (!startTime || !endTime) throw new Error('startTime and endTime required (HH:MM)')
  const days = [...new Set(opts.days.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))]
  if (days.length === 0) throw new Error('Select at least one day')

  const rbtProfileId = await resolveRbtProfileId(opts.btName)
  if (!rbtProfileId) {
    throw new Error(`No active RBT found matching "${opts.btName.trim()}"`)
  }

  const client = await prisma.serviceClient.findUnique({
    where: { id: opts.serviceClientId },
    select: { borough: true },
  })
  if (!client) throw new Error('Client not found')

  let created = 0
  for (const dayOfWeek of days) {
    const existing = await prisma.rbtScheduleAssignment.findFirst({
      where: {
        rbtProfileId,
        clientName: { equals: scheduleClientName, mode: 'insensitive' },
        dayOfWeek,
        startTime,
        endTime,
        isActive: true,
        OR: [
          { periodStart: period.startDate, periodEnd: period.endDate },
          { source: 'MANUAL', periodStart: null, periodEnd: null },
        ],
      },
    })
    if (existing) {
      await prisma.rbtScheduleAssignment.update({
        where: { id: existing.id },
        data: {
          serviceClientId: opts.serviceClientId,
          serviceClientLinkManual: true,
          clientName: scheduleClientName,
          periodStart: period.startDate,
          periodEnd: period.endDate,
          source: 'MANUAL',
        },
      })
      created++
      continue
    }
    await prisma.rbtScheduleAssignment.create({
      data: {
        rbtProfileId,
        clientName: scheduleClientName,
        dayOfWeek,
        startTime,
        endTime,
        location: '12-Home',
        source: 'MANUAL',
        clientBorough: client.borough || 'Unset',
        periodStart: period.startDate,
        periodEnd: period.endDate,
        serviceClientId: opts.serviceClientId,
        serviceClientLinkManual: true,
        createdBy: opts.createdByUserId,
      },
    })
    created++
  }

  return { created, scheduleClientName, rbtProfileId }
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
