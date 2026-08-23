import { prisma } from '@/lib/prisma'
import type { Prisma, ScheduleDayOfWeek } from '@prisma/client'
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
 * Soft-deactivate all assignments for a period and remove import batch records
 * so the week leaves the period picker. Does not touch MANUAL rows with null periods.
 */
export async function deleteSchedulePeriod(opts: {
  periodStart: Date
  periodEnd: Date
}): Promise<{
  deactivatedAssignments: number
  deletedBatches: number
  periodStart: string
  periodEnd: string
}> {
  const { periodStart, periodEnd } = opts

  const [assignments, batches] = await Promise.all([
    prisma.rbtScheduleAssignment.updateMany({
      where: {
        isActive: true,
        periodStart,
        periodEnd,
      },
      data: { isActive: false },
    }),
    prisma.scheduleImportBatch.deleteMany({
      where: { periodStart, periodEnd },
    }),
  ])

  return {
    deactivatedAssignments: assignments.count,
    deletedBatches: batches.count,
    periodStart: isoDate(periodStart),
    periodEnd: isoDate(periodEnd),
  }
}


/**
 * Load schedule workspace data for a biweekly period from rbt_schedule_assignments.
 * Legacy session_slot rows are not read for the live board.
 */
export async function loadPeriodWorkspaceData(opts: {
  periodStart?: Date | null
  periodEnd?: Date | null
  boroughFilter?: string | null
  /** LIVE service_client ids the viewer may see; 'ALL' = every LIVE client. */
  liveClientIds?: string[] | 'ALL'
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

  const liveClients = await prisma.serviceClient.findMany({
    where: {
      deletedAt: null,
      pipelineStatus: 'LIVE',
      ...(opts.liveClientIds && opts.liveClientIds !== 'ALL'
        ? { id: { in: opts.liveClientIds } }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      borough: true,
      authHours: true,
      clientCode: true,
      stage: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  const liveIdSet = new Set(liveClients.map((c) => c.id))
  const allowUnlinked = opts.liveClientIds === 'ALL' || opts.liveClientIds == null

  const assignmentWhere: Prisma.RbtScheduleAssignmentWhereInput = {
    isActive: true,
    deletedAt: null,
    reviewStatus: { in: ['NONE', 'CONFIRMED'] },
  }
  if (periodStart && periodEnd) {
    assignmentWhere.OR = [
      { periodStart, periodEnd },
      { source: 'MANUAL', periodStart: null, periodEnd: null },
    ]
  }

  const assignments = await prisma.rbtScheduleAssignment.findMany({
    where: assignmentWhere,
    include: {
      rbtProfile: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      serviceClient: {
        select: { id: true, pipelineStatus: true, deletedAt: true },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })

  const visibleAssignments = assignments.filter((a) => {
    if (a.serviceClientId) {
      if (a.serviceClient?.deletedAt) return false
      if (a.serviceClient?.pipelineStatus !== 'LIVE') return false
      return liveIdSet.has(a.serviceClientId)
    }
    return allowUnlinked
  })

  const boroughFilter = opts.boroughFilter?.trim() || null
  const filtered = boroughFilter
    ? visibleAssignments.filter((a) => {
        const b = a.clientBorough || 'Unset'
        return boroughFilter === 'Unset' ? b === 'Unset' || !a.clientBorough : b === boroughFilter
      })
    : visibleAssignments

  const therapistMap = new Map<string, ScheduleTherapist>()
  const clientMap = new Map<string, ScheduleClient>()
  const slots: ScheduleSlot[] = []

  for (const c of liveClients) {
    const name = `${c.firstName} ${c.lastName}`.trim()
    clientMap.set(c.id, {
      id: c.id,
      code: c.clientCode,
      name,
      borough: c.borough,
      insurance: null,
      bcba: null,
      authorizedHoursPerWeek: c.authHours,
      active: false,
      stage: c.stage,
    })
  }

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

    let clientId: string
    if (a.serviceClientId && clientMap.has(a.serviceClientId)) {
      clientId = a.serviceClientId
    } else {
      const clientKey = a.clientName.trim().toLowerCase()
      clientId = `client:${clientKey}`
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          id: clientId,
          code: null,
          name: a.clientName,
          borough: a.clientBorough === 'Unset' ? null : a.clientBorough,
          insurance: null,
          bcba: null,
          authorizedHoursPerWeek: null,
          active: true,
          stage: null,
        })
      }
    }

    const startMin = parseTimeToMinutes(a.startTime) ?? 0
    const endMin = parseTimeToMinutes(a.endTime) ?? 0
    slots.push({
      id: a.id,
      therapistId: tid,
      clientId,
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

  const clientIdsWithSlots = new Set(slots.map((s) => s.clientId))
  for (const client of clientMap.values()) {
    client.active = clientIdsWithSlots.has(client.id)
  }

  const hiredWithoutSlots = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED', id: { notIn: [...therapistMap.keys()] } },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 200,
  })
  for (const r of hiredWithoutSlots) {
    therapistMap.set(r.id, {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`.trim(),
      email: r.email,
      role: 'RBT',
      borough: null,
      colorKey: null,
      active: true,
    })
  }

  const unsetClients = await prisma.clientBorough.count({
    where: { OR: [{ borough: 'Unset' }, { borough: '' }] },
  })
  const unsetInView = new Set(
    filtered.filter((a) => !a.clientBorough || a.clientBorough === 'Unset').map((a) => a.clientName)
  )

  return {
    therapists: [...therapistMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    clients: [...clientMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    slots,
    allowedEmails: allowedUsers.map((u) => u.email),
    allowedUsers: allowedUsers.map((u) => ({ id: u.id, email: u.email })),
    periodStart: periodStart ? isoDate(periodStart) : null,
    periodEnd: periodEnd ? isoDate(periodEnd) : null,
    unsetClientCount: Math.max(unsetClients, unsetInView.size),
    fromAssignments: true,
  }
}
