import { prisma } from '@/lib/prisma'
import type { ScheduleDayOfWeek } from '@prisma/client'
import type {
  ScheduleClient,
  ScheduleSlot,
  ScheduleTherapist,
  ScheduleWorkspaceData,
} from '@/lib/schedule/types'
import { parseTimeToMinutes } from '@/lib/rbt-schedule/utils'

const JS_TO_DAY: ScheduleDayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

import type { SchedulePeriod } from './types'

export type { SchedulePeriod }

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function listSchedulePeriods(): Promise<SchedulePeriod[]> {
  const batches = await prisma.scheduleImportBatch.findMany({
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
  })
  return batches.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    periodStart: isoDate(b.periodStart),
    periodEnd: isoDate(b.periodEnd),
    providerCount: b.providerCount,
    slotCount: b.slotCount,
    createdAt: b.createdAt.toISOString(),
  }))
}

export async function getLatestPeriodRange(): Promise<{
  periodStart: Date
  periodEnd: Date
} | null> {
  const latest = await prisma.scheduleImportBatch.findFirst({
    orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
  })
  if (!latest) return null
  return { periodStart: latest.periodStart, periodEnd: latest.periodEnd }
}

/**
 * Load schedule workspace data for a biweekly period from rbt_schedule_assignments,
 * falling back to classic session_slot templates when no period data exists.
 */
export async function loadPeriodWorkspaceData(opts: {
  periodStart?: Date | null
  periodEnd?: Date | null
  boroughFilter?: string | null
}): Promise<
  ScheduleWorkspaceData & {
    periodStart: string | null
    periodEnd: string | null
    unsetClientCount: number
    fromAssignments: boolean
  }
> {
  const allowedUsers = await prisma.scheduleAllowedUser.findMany({
    orderBy: { email: 'asc' },
  })

  const periodStart = opts.periodStart ?? null
  const periodEnd = opts.periodEnd ?? null

  if (periodStart && periodEnd) {
    const assignments = await prisma.rbtScheduleAssignment.findMany({
      where: {
        isActive: true,
        OR: [
          { periodStart, periodEnd },
          // MANUAL rows without period still appear in every view
          { source: 'MANUAL', periodStart: null, periodEnd: null },
        ],
      },
      include: {
        rbtProfile: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    const boroughFilter = opts.boroughFilter?.trim() || null
    const filtered = boroughFilter
      ? assignments.filter((a) => {
          const b = a.clientBorough || 'Unset'
          return boroughFilter === 'Unset' ? b === 'Unset' || !a.clientBorough : b === boroughFilter
        })
      : assignments

    const therapistMap = new Map<string, ScheduleTherapist>()
    const clientMap = new Map<string, ScheduleClient>()
    const slots: ScheduleSlot[] = []

    for (const a of filtered) {
      const tid = a.rbtProfileId
      if (!therapistMap.has(tid)) {
        therapistMap.set(tid, {
          id: tid,
          name: `${a.rbtProfile.firstName} ${a.rbtProfile.lastName}`.trim(),
          email: a.rbtProfile.email,
          role: 'RBT',
          borough: null,
          colorKey: null,
          active: true,
        })
      }

      const clientKey = a.clientName.trim().toLowerCase()
      let client = clientMap.get(clientKey)
      if (!client) {
        client = {
          id: `client:${clientKey}`,
          code: null,
          name: a.clientName,
          borough: a.clientBorough === 'Unset' ? null : a.clientBorough,
          insurance: null,
          bcba: null,
          authorizedHoursPerWeek: null,
          active: true,
        }
        clientMap.set(clientKey, client)
      }

      const startMin = parseTimeToMinutes(a.startTime) ?? 0
      const endMin = parseTimeToMinutes(a.endTime) ?? 0
      slots.push({
        id: a.id,
        therapistId: tid,
        clientId: client.id,
        day: JS_TO_DAY[a.dayOfWeek] ?? 'MON',
        startMin,
        endMin,
        status: 'CONFIRMED',
        procedureCode: '97153',
        placeOfService: a.location || '12-Home',
        note: a.source === 'MANUAL' ? a.notes : a.notes ?? `Artemis (${a.source})`,
        createdBy: a.createdBy,
        updatedBy: null,
      })
    }

    const unsetClients = await prisma.clientBorough.count({
      where: { OR: [{ borough: 'Unset' }, { borough: '' }] },
    })
    // Also count assignment clients with unset borough not in table
    const unsetInView = new Set(
      filtered.filter((a) => !a.clientBorough || a.clientBorough === 'Unset').map((a) => a.clientName)
    )

    return {
      therapists: [...therapistMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      clients: [...clientMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      slots,
      allowedEmails: allowedUsers.map((u) => u.email),
      allowedUsers: allowedUsers.map((u) => ({ id: u.id, email: u.email })),
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      unsetClientCount: Math.max(unsetClients, unsetInView.size),
      fromAssignments: true,
    }
  }

  // Legacy fallback: classic weekly template tables
  const [therapists, clients, slots] = await Promise.all([
    prisma.scheduleTherapist.findMany({ orderBy: { name: 'asc' } }),
    prisma.scheduleWeeklyClient.findMany({ orderBy: { name: 'asc' } }),
    prisma.scheduleSessionSlot.findMany(),
  ])

  let filteredSlots = slots
  let filteredClients = clients
  if (opts.boroughFilter) {
    const bf = opts.boroughFilter
    filteredClients = clients.filter((c) =>
      bf === 'Unset' ? !c.borough : c.borough === bf
    )
    const ids = new Set(filteredClients.map((c) => c.id))
    filteredSlots = slots.filter((s) => ids.has(s.clientId))
  }

  const unsetClientCount = clients.filter((c) => !c.borough).length

  return {
    therapists: therapists.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      role: t.role,
      borough: t.borough,
      colorKey: t.colorKey,
      active: t.active,
    })),
    clients: filteredClients.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      borough: c.borough,
      insurance: c.insurance,
      bcba: c.bcba,
      authorizedHoursPerWeek: c.authorizedHoursPerWeek
        ? Number(c.authorizedHoursPerWeek)
        : null,
      active: c.active,
    })),
    slots: filteredSlots.map((s) => ({
      id: s.id,
      therapistId: s.therapistId,
      clientId: s.clientId,
      day: s.day,
      startMin: s.startMin,
      endMin: s.endMin,
      status: s.status,
      procedureCode: s.procedureCode,
      placeOfService: s.placeOfService,
      note: s.note,
      createdBy: s.createdBy,
      updatedBy: s.updatedBy,
    })),
    allowedEmails: allowedUsers.map((u) => u.email),
    allowedUsers: allowedUsers.map((u) => ({ id: u.id, email: u.email })),
    periodStart: null,
    periodEnd: null,
    unsetClientCount,
    fromAssignments: false,
  }
}
