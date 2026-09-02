import 'server-only'

import {
  getVisibleClientsWhere,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { getClientsNeedingStaffing } from '@/lib/crm/staffing/needsStaffing'
import { MAP_THERAPIST_WHERE } from '@/lib/crm/therapistClientMap/constants'
import { validateMapCoordinates } from '@/lib/crm/therapistClientMap/coordinateValidation'
import { formatAddressSummary } from '@/lib/crm/therapistClientMap/geocodeClients'
import {
  clientMarkerFromStage,
  THERAPIST_MARKER_HEX,
  therapistMarkerColor,
  therapistStatusLabel,
} from '@/lib/crm/therapistClientMap/markerColors'
import {
  loadRbtScheduledHoursByProfileId,
  parseWeeklyHourCap,
  therapistHasCapacity,
} from '@/lib/crm/therapistClientMap/rbtCapacity'
import type {
  ExcludedMapEntity,
  MapAssignmentPair,
  MapClientEntity,
  MapTherapistEntity,
  TherapistClientMapData,
} from '@/lib/crm/therapistClientMap/types'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'

export { MAP_THERAPIST_WHERE } from '@/lib/crm/therapistClientMap/constants'

const HIRED_STATUSES = new Set(['HIRED', 'ONBOARDING_COMPLETED'])

function exclusionReasonLabel(reason: string): string {
  if (reason.startsWith('coordinates_outside_')) {
    return 'Pin outside address state'
  }
  if (reason === 'outside_coverage_area') return 'Outside service area (NY/NJ/PA/CT/FL)'
  if (reason === 'missing_coordinates') return 'Address not geocoded'
  return 'Could not place on map'
}

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

  const therapistNameById = new Map(
    therapists.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()])
  )

  const mappedTherapists: MapTherapistEntity[] = []
  const mappedClients: MapClientEntity[] = []
  const excluded: ExcludedMapEntity[] = []
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
    const markerColor = therapistMarkerColor(t.status)
    const addressSummary = formatAddressSummary({
      addressLine1: t.addressLine1,
      locationCity: t.locationCity,
      locationState: t.locationState,
      zipCode: t.zipCode,
    })

    if (t.latitude != null && t.longitude != null) {
      const validation = validateMapCoordinates(
        t.latitude,
        t.longitude,
        t.locationState
      )
      if (validation.valid) {
        mappedTherapists.push({
          entityType: 'therapist',
          id: t.id,
          name,
          status: t.status,
          markerColor,
          markerHex: THERAPIST_MARKER_HEX[markerColor],
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
      } else {
        excluded.push({
          entityType: 'therapist',
          id: t.id,
          name,
          addressSummary,
          reason: exclusionReasonLabel(validation.reason),
        })
      }
    } else if (addressSummary) {
      excluded.push({
        entityType: 'therapist',
        id: t.id,
        name,
        addressSummary,
        reason: exclusionReasonLabel('missing_coordinates'),
      })
    }
  }

  for (const c of clients) {
    const name = `${c.firstName} ${c.lastName}`.trim() || c.clientCode
    const reasons = needsStaffingMap.get(c.id) ?? []
    const needsStaffing = reasons.length > 0
    const stageMarker = clientMarkerFromStage(c.stage)
    const addressSummary = formatAddressSummary(c)

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
      const validation = validateMapCoordinates(c.latitude, c.longitude, c.state)
      if (validation.valid) {
        mappedClients.push({
          entityType: 'client',
          id: c.id,
          clientCode: c.clientCode,
          name,
          stage: c.stage,
          stageGroup: stageMarker.stageGroup,
          markerColor: stageMarker.markerColor,
          markerHex: stageMarker.markerHex,
          needsStaffing,
          needsStaffingReasons: reasons,
          statusLabel: stageMarker.statusLabel,
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
      } else {
        excluded.push({
          entityType: 'client',
          id: c.id,
          name: `${name} (${c.clientCode})`,
          addressSummary,
          reason: exclusionReasonLabel(validation.reason),
        })
      }
    } else if (addressSummary) {
      excluded.push({
        entityType: 'client',
        id: c.id,
        name: `${name} (${c.clientCode})`,
        addressSummary,
        reason: exclusionReasonLabel('missing_coordinates'),
      })
    }
  }

  return {
    therapists: mappedTherapists,
    clients: mappedClients,
    assignmentPairs,
    excluded,
    stats: {
      therapistTotal: therapists.length,
      therapistMapped: mappedTherapists.length,
      clientTotal: clients.length,
      clientMapped: mappedClients.length,
      clientsNeedingStaffing: needsStaffingMap.size,
      excludedCount: excluded.length,
    },
  }
}
