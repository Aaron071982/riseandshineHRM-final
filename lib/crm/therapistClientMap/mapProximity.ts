import 'server-only'

import type { Prisma } from '@prisma/client'
import {
  getVisibleClientsWhere,
  type CrmAccessSubject,
} from '@/lib/crm/access'
import { PLACEABLE_RBT_WHERE } from '@/lib/crm/therapistSearch'
import { runRbtProximitySearch } from '@/lib/scheduling-beta/proximitySearch'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'
import { statesAreCompatible } from '@/lib/crm/therapistClientMap/coverageStates'
import {
  loadRbtScheduledHoursByProfileId,
  parseWeeklyHourCap,
  therapistHasCapacity,
} from '@/lib/crm/therapistClientMap/rbtCapacity'
import type { MapProximityResult } from '@/lib/crm/therapistClientMap/types'

const HIRED_WHERE: Prisma.RBTProfileWhereInput = {
  status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] },
  activityState: 'ACTIVE',
}

export async function findNearestTherapistsForMapClient(
  user: CrmAccessSubject,
  clientId: string
): Promise<MapProximityResult | { error: string; status: number }> {
  const client = await prisma.serviceClient.findFirst({
    where: {
      id: clientId,
      ...NOT_DELETED,
      pipelineStatus: 'LIVE',
      AND: [getVisibleClientsWhere(user)],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      clientCode: true,
      addressLine: true,
      city: true,
      state: true,
      zip: true,
      latitude: true,
      longitude: true,
      btAssignments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { rbtProfileId: true },
      },
    },
  })

  if (!client) {
    return { error: 'Client not found or access denied', status: 404 }
  }

  const [scheduledByRbt, hiredProfiles] = await Promise.all([
    loadRbtScheduledHoursByProfileId(),
    prisma.rBTProfile.findMany({
      where: {
        ...HIRED_WHERE,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        preferredHoursRange: true,
        locationState: true,
        serviceClientBtAssignments: {
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { serviceClientId: true },
        },
      },
    }),
  ])

  const assignedToClient = new Set(
    client.btAssignments
      .map((a) => a.rbtProfileId)
      .filter((id): id is string => !!id)
  )

  const eligibleIds: string[] = []
  for (const profile of hiredProfiles) {
    const assignedCount = profile.serviceClientBtAssignments.length
    const scheduled = scheduledByRbt.get(profile.id) ?? 0
    const cap = parseWeeklyHourCap(profile.preferredHoursRange)
    const hasCapacity = therapistHasCapacity(scheduled, cap)
    const unmatched = assignedCount === 0
    if (!unmatched && !hasCapacity) continue
    if (!statesAreCompatible(client.state, profile.locationState)) continue
    if (assignedToClient.has(profile.id) && !hasCapacity) continue
    eligibleIds.push(profile.id)
  }

  if (eligibleIds.length === 0) {
    return {
      client: {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`.trim(),
        clientCode: client.clientCode,
        lat: client.latitude ?? 0,
        lng: client.longitude ?? 0,
        state: client.state,
      },
      therapists: [],
      message: 'No available hired therapists in this state with remaining capacity.',
    }
  }

  const search = await runRbtProximitySearch({
    clientAddress: client.addressLine,
    clientCity: client.city,
    clientState: client.state,
    clientZip: client.zip,
    clientLatitude: client.latitude,
    clientLongitude: client.longitude,
    limit: 12,
    rbtWhere: {
      ...PLACEABLE_RBT_WHERE,
      ...HIRED_WHERE,
      id: { in: eligibleIds },
    },
  })

  if ('error' in search) {
    return { error: search.error, status: search.status }
  }

  const profileById = new Map(hiredProfiles.map((p) => [p.id, p]))

  const therapists = search.rbts.map((rbt) => {
    const profile = profileById.get(rbt.rbtProfileId)
    const scheduled = scheduledByRbt.get(rbt.rbtProfileId) ?? 0
    const cap = parseWeeklyHourCap(profile?.preferredHoursRange)
    const assignedCount = profile?.serviceClientBtAssignments.length ?? 0
    const hasCapacity = therapistHasCapacity(scheduled, cap)

    return {
      rbtProfileId: rbt.rbtProfileId,
      name: `${rbt.firstName} ${rbt.lastName}`.trim(),
      drivingDistanceMiles: rbt.drivingDistanceMiles,
      drivingDurationMinutes: rbt.drivingDurationMinutes,
      lat: rbt.latitude!,
      lng: rbt.longitude!,
      hasCapacity,
      isUnmatched: assignedCount === 0,
      scheduledHoursPerWeek: scheduled,
      weeklyHourCap: cap,
      stateViable: statesAreCompatible(client.state, profile?.locationState),
      fullAddress: rbt.fullAddress,
    }
  })

  return {
    client: {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`.trim(),
      clientCode: client.clientCode,
      lat: search.clientLat,
      lng: search.clientLng,
      state: client.state,
    },
    therapists,
    message: search.message,
  }
}
