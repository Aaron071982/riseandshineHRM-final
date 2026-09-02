import 'server-only'

import { parseCalendarDate } from '@/lib/billing/calendarDate'
import {
  getClientsNeedingStaffing,
  type NeedsStaffingReason,
} from '@/lib/crm/staffing/needsStaffing'
import {
  flagClientRbtReplacement,
  flagRbtStaffDeparting,
} from '@/lib/crm/staffing/departureService'
import { findNearestTherapistsForMapClient } from '@/lib/crm/therapistClientMap/mapProximity'
import {
  loadRbtScheduledHoursByProfileId,
  parseWeeklyHourCap,
  therapistHasCapacity,
} from '@/lib/crm/therapistClientMap/rbtCapacity'
import { getMcpCrmUser } from '@/lib/mcp/crmUser'
import { jsonToolResult } from '@/lib/mcp/format'
import { getMcpSystemUserId } from '@/lib/mcp/systemUser'
import type { ToolResult } from '@/lib/mcp/types'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'

const REASON_LABEL: Record<NeedsStaffingReason, string> = {
  unstaffed: 'Needs staffing',
  understaffed: 'Needs more hours',
  losing_staff_soon: 'Losing staff soon',
}

export async function getClientsNeedingStaffingTool(): Promise<ToolResult> {
  const needsMap = await getClientsNeedingStaffing()
  const ids = [...needsMap.keys()]
  if (ids.length === 0) {
    return {
      text: '# Clients needing staffing\n\nNo clients currently flagged.',
      summary: { count: 0 },
    }
  }

  const clients = await prisma.serviceClient.findMany({
    where: { id: { in: ids }, ...NOT_DELETED },
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      stage: true,
      state: true,
      city: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const rows = clients.map((c) => ({
    id: c.id,
    clientCode: c.clientCode,
    name: `${c.firstName} ${c.lastName}`.trim(),
    stage: c.stage,
    location: [c.city, c.state].filter(Boolean).join(', ') || null,
    reasons: (needsMap.get(c.id) ?? []).map((r) => REASON_LABEL[r]),
  }))

  return jsonToolResult(
    `Clients needing staffing (${rows.length})`,
    { count: rows.length, clients: rows },
    { count: rows.length }
  )
}

export async function getStaffCaseload(args: {
  staff: string
}): Promise<ToolResult> {
  const q = args.staff?.trim()
  if (!q) throw new Error('staff is required (RBT profile ID or name)')

  const profile = await prisma.rBTProfile.findFirst({
    where: {
      OR: [
        { id: q },
        { email: { equals: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      preferredHoursRange: true,
      departing: true,
      serviceClientBtAssignments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: {
          serviceClient: {
            select: {
              id: true,
              clientCode: true,
              firstName: true,
              lastName: true,
              stage: true,
            },
          },
        },
      },
      scheduleAssignments: {
        where: { deletedAt: null, isActive: true },
        select: {
          serviceClientId: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  })

  if (!profile) throw new Error(`Staff not found: ${q}`)

  const scheduledByRbt = await loadRbtScheduledHoursByProfileId()
  const scheduled = scheduledByRbt.get(profile.id) ?? 0
  const cap = parseWeeklyHourCap(profile.preferredHoursRange)
  const hasCapacity = therapistHasCapacity(scheduled, cap)

  const clientMap = new Map<
    string,
    { id: string; clientCode: string; name: string; stage: string; slots: number }
  >()

  for (const a of profile.serviceClientBtAssignments) {
    const c = a.serviceClient
    if (!c) continue
    clientMap.set(c.id, {
      id: c.id,
      clientCode: c.clientCode,
      name: `${c.firstName} ${c.lastName}`.trim(),
      stage: c.stage,
      slots: 0,
    })
  }

  for (const s of profile.scheduleAssignments) {
    if (!s.serviceClientId) continue
    const existing = clientMap.get(s.serviceClientId)
    if (existing) existing.slots += 1
  }

  return jsonToolResult(
    `Caseload — ${profile.firstName} ${profile.lastName}`,
    {
      rbtProfileId: profile.id,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      status: profile.status,
      departing: profile.departing,
      scheduledHoursPerWeek: scheduled,
      weeklyHourCap: cap,
      hasCapacity,
      clients: [...clientMap.values()],
    },
    {
      rbtProfileId: profile.id,
      clientCount: clientMap.size,
      scheduledHoursPerWeek: scheduled,
    }
  )
}

export async function findNearestTherapists(args: {
  client: string
  only_available?: boolean
  include_capacity?: boolean
}): Promise<ToolResult> {
  const clientId = args.client?.trim()
  if (!clientId) throw new Error('client is required')

  const user = await getMcpCrmUser()
  const result = await findNearestTherapistsForMapClient(user, clientId)

  if ('error' in result) {
    throw new Error(result.error)
  }

  let therapists = result.therapists
  if (args.only_available !== false) {
    therapists = therapists.filter((t) => t.isUnmatched || t.hasCapacity)
  }
  if (args.include_capacity === false) {
    therapists = therapists
  }

  return jsonToolResult(
    `Nearest therapists for ${result.client.name}`,
    {
      client: result.client,
      message: result.message ?? null,
      therapists: therapists.map((t, i) => ({
        rank: i + 1,
        rbtProfileId: t.rbtProfileId,
        name: t.name,
        driveMinutes: t.drivingDurationMinutes,
        driveMiles: t.drivingDistanceMiles,
        hasCapacity: t.hasCapacity,
        isUnmatched: t.isUnmatched,
        scheduledHours: t.scheduledHoursPerWeek,
        weeklyCap: t.weeklyHourCap,
        stateViable: t.stateViable,
      })),
    },
    {
      clientId: result.client.id,
      candidateCount: therapists.length,
    }
  )
}

export async function flagStaffing(args: {
  client?: string
  rbtProfileId?: string
  staff?: string
  reason?: string
  expected_end_date?: string
  last_day?: string
  departure_note?: string
}): Promise<ToolResult> {
  const userId = await getMcpSystemUserId()
  const rbtId = (args.rbtProfileId ?? args.staff)?.trim()

  if (rbtId && args.last_day) {
    const lastDay = parseCalendarDate(args.last_day)
    if (!lastDay) throw new Error('last_day must be YYYY-MM-DD')

    const result = await flagRbtStaffDeparting({
      rbtProfileId: rbtId,
      lastDay,
      departureNote: args.departure_note ?? null,
      flaggedByUserId: userId,
    })

    return {
      text: `Flagged staff ${rbtId} as departing (last day ${args.last_day}). Updated ${result.updatedAssignmentRows} assignment row(s) across ${result.affectedClientIds.length} client(s).`,
      summary: {
        rbtProfileId: rbtId,
        lastDay: args.last_day,
        updatedAssignmentRows: result.updatedAssignmentRows,
        affectedClientCount: result.affectedClientIds.length,
      },
    }
  }

  const clientId = args.client?.trim()
  if (!clientId || !rbtId) {
    throw new Error(
      'Provide client + rbtProfileId/staff for assignment flag, or rbtProfileId/staff + last_day for staff departure.'
    )
  }

  const reason = args.reason?.trim()
  if (!reason) throw new Error('reason is required for assignment-level flag')

  const expectedEnd = parseCalendarDate(args.expected_end_date ?? '')
  if (!expectedEnd) throw new Error('expected_end_date must be YYYY-MM-DD')

  const resolvedClient = await prisma.serviceClient.findFirst({
    where: { OR: [{ id: clientId }, { clientCode: { equals: clientId, mode: 'insensitive' } }] },
    select: { id: true },
  })
  if (!resolvedClient) throw new Error(`Client not found: ${clientId}`)

  const { updatedCount } = await flagClientRbtReplacement({
    serviceClientId: resolvedClient.id,
    rbtProfileId: rbtId,
    reason,
    expectedEndDate: expectedEnd,
    flaggedByUserId: userId,
  })

  return {
    text: `Flagged replacement need for client ${resolvedClient.id} / RBT ${rbtId}. Updated ${updatedCount} schedule row(s).`,
    summary: {
      clientId: resolvedClient.id,
      rbtProfileId: rbtId,
      updatedCount,
    },
  }
}
