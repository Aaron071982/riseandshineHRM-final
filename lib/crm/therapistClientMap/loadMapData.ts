import 'server-only'

import type { Prisma } from '@prisma/client'
import {
  getVisibleClientsWhere,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { getClientsNeedingStaffing } from '@/lib/crm/staffing/needsStaffing'
import {
  clientMarkerColor,
  clientStatusLabel,
  therapistMarkerColor,
  therapistStatusLabel,
} from '@/lib/crm/therapistClientMap/markerColors'
import { formatAddressSummary } from '@/lib/crm/therapistClientMap/geocodeClients'
import {
  loadRbtScheduledHoursByProfileId,
  parseWeeklyHourCap,
  therapistHasCapacity,
} from '@/lib/crm/therapistClientMap/rbtCapacity'
import type {
  MapAssignmentPair,
  MapClientEntity,
  MapTherapistEntity,
  TherapistClientMapData,
  UnmappedEntity,
} from '@/lib/crm/therapistClientMap/types'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'

/** All RBTs in the hiring pipeline through hired (excludes fired/rejected). */
export const MAP_THERAPIST_WHERE: Prisma.RBTProfileWhereInput = {
  status: { notIn: ['FIRED', 'REJECTED'] },
}

const HIRED_STATUSES = new Set(['HIRED', 'ONBOARDING_COMPLETED'])

export async function loadTherapistClientMapData(
  user: CrmAccessSubject
): Promise<TherapistClientMapData> {
  const [needsStaffingMap, scheduledByRbt, therapists, clients] =
    await Promise.all([
      getClientsNeedingStaffing(),
      loadRbtScheduledHoursByProfileId(),
      prisma.rBTProfile.findMany({
        where: MAP_THERAPIST_WHERE,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          locationCity: true,
          locationState: true,
          zipCode: true,
          addressLine1: true,
          latitude: true,
          longitude: true,
          preferredHoursRange: true,
          serviceClientBtAssignments: {
            where: { deletedAt: null, status: 'ACTIVE' },
            select: { serviceClientId: true },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.serviceClient.findMany({
        where: {
          AND: [
            { ...NOT_DELETED },
            { pipelineStatus: 'LIVE' },
            getVisibleClientsWhere(user),
          ],
        },
        select: {
          id: true,
          clientCode: true,
          firstName: true,
          lastName: true,
          stage: true,
          addressLine: true,
          city: true,
          state: true,
          zip: true,
          latitude: true,
          longitude: true,
          btAssignments: {
            where: { deletedAt: null, status: 'ACTIVE' },
            select: {
              btName: true,
              isPrimary: true,
              rbtProfileId: true,
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ])

  const clientNameById = new Map(
    clients.map((c) => [
      c.id,
      `${c.firstName} ${c.lastName}`.trim() || c.clientCode,
    ])
  )

  const therapistNameById = new Map(
    therapists.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()])
  )

  const mappedTherapists: MapTherapistEntity[] = []
  const mappedClients: MapClientEntity[] = []
  const unmapped: UnmappedEntity[] = []
  const assignmentPairs: MapAssignmentPair[] = []
  const pairKeys = new Set<string>()

  for (const t of therapists) {
    const name = therapistNameById.get(t.id) ?? 'Therapist'
    const assignedClientIds = [
      ...new Set(
        t.serviceClientBtAssignments.map((a) => a.serviceClientId)
      ),
    ]
    const scheduled = scheduledByRbt.get(t.id) ?? 0
    const weeklyHourCap = parseWeeklyHourCap(t.preferredHoursRange)
    const hired = HIRED_STATUSES.has(t.status)
    const hasCapacity = hired && therapistHasCapacity(scheduled, weeklyHourCap)
    const isUnmatched = hired && assignedClientIds.length === 0

    if (t.latitude != null && t.longitude != null) {
      mappedTherapists.push({
        entityType: 'therapist',
        id: t.id,
        name,
        status: t.status,
        markerColor: therapistMarkerColor(t.status),
        statusLabel: therapistStatusLabel(t.status),
        state: t.locationState,
        city: t.locationCity,
        lat: t.latitude,
        lng: t.longitude,
        assignedClientIds,
        scheduledHoursPerWeek: scheduled,
        weeklyHourCap,
        hasCapacity,
        isUnmatched,
      })
    } else if (
      [t.addressLine1, t.locationCity, t.locationState, t.zipCode].some(
        (v) => v?.trim()
      )
    ) {
      unmapped.push({
        entityType: 'therapist',
        id: t.id,
        name,
        addressSummary: formatAddressSummary({
          addressLine: t.addressLine1,
          city: t.locationCity,
          state: t.locationState,
          zip: t.zipCode,
        }),
      })
    }
  }

  for (const c of clients) {
    const name = clientNameById.get(c.id) ?? c.clientCode
    const reasons = needsStaffingMap.get(c.id) ?? []
    const needsStaffing = reasons.length > 0

    for (const a of c.btAssignments) {
      if (!a.rbtProfileId) continue
      const key = `${c.id}:${a.rbtProfileId}`
      if (pairKeys.has(key)) continue
      pairKeys.add(key)
      assignmentPairs.push({
        clientId: c.id,
        therapistId: a.rbtProfileId,
        clientName: name,
        therapistName:
          therapistNameById.get(a.rbtProfileId) ?? a.btName,
      })
    }

    if (c.latitude != null && c.longitude != null) {
      mappedClients.push({
        entityType: 'client',
        id: c.id,
        clientCode: c.clientCode,
        name,
        stage: c.stage,
        markerColor: clientMarkerColor(needsStaffing),
        needsStaffing,
        needsStaffingReasons: reasons,
        statusLabel: clientStatusLabel(needsStaffing, reasons),
        state: c.state,
        city: c.city,
        lat: c.latitude,
        lng: c.longitude,
        assignments: c.btAssignments.map((a) => ({
          rbtProfileId: a.rbtProfileId,
          btName: a.btName,
          isPrimary: a.isPrimary,
        })),
      })
    } else if (
      [c.addressLine, c.city, c.state, c.zip].some((v) => v?.trim())
    ) {
      unmapped.push({
        entityType: 'client',
        id: c.id,
        name: `${name} (${c.clientCode})`,
        addressSummary: formatAddressSummary(c),
      })
    }
  }

  return {
    therapists: mappedTherapists,
    clients: mappedClients,
    assignmentPairs,
    unmapped,
    stats: {
      therapistTotal: therapists.length,
      therapistMapped: mappedTherapists.length,
      clientTotal: clients.length,
      clientMapped: mappedClients.length,
      clientsNeedingStaffing: needsStaffingMap.size,
    },
  }
}
