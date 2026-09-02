import type { NeedsStaffingReason } from '@/lib/crm/staffing/needsStaffing'
import type { RBTStatus } from '@prisma/client'

export type TherapistMarkerColor = 'green' | 'blue'
export type ClientMarkerColor = 'orange' | 'black'

export type MapTherapistEntity = {
  entityType: 'therapist'
  id: string
  name: string
  status: RBTStatus
  markerColor: TherapistMarkerColor
  statusLabel: string
  state: string | null
  city: string | null
  lat: number
  lng: number
  assignedClientIds: string[]
  scheduledHoursPerWeek: number
  weeklyHourCap: number
  hasCapacity: boolean
  isUnmatched: boolean
}

export type MapAssignmentPair = {
  clientId: string
  therapistId: string
  clientName: string
  therapistName: string
}

export type MapClientAssignment = {
  rbtProfileId: string | null
  btName: string
  isPrimary: boolean
}

export type MapClientEntity = {
  entityType: 'client'
  id: string
  clientCode: string
  name: string
  stage: string
  markerColor: ClientMarkerColor
  needsStaffing: boolean
  needsStaffingReasons: NeedsStaffingReason[]
  statusLabel: string
  state: string | null
  city: string | null
  lat: number
  lng: number
  assignments: MapClientAssignment[]
}

export type UnmappedEntity = {
  entityType: 'therapist' | 'client'
  id: string
  name: string
  addressSummary: string
}

export type TherapistClientMapData = {
  therapists: MapTherapistEntity[]
  clients: MapClientEntity[]
  assignmentPairs: MapAssignmentPair[]
  unmapped: UnmappedEntity[]
  stats: {
    therapistTotal: number
    therapistMapped: number
    clientTotal: number
    clientMapped: number
    clientsNeedingStaffing: number
  }
}

export type MapProximityTherapist = {
  rbtProfileId: string
  name: string
  drivingDistanceMiles: number | null
  drivingDurationMinutes: number | null
  lat: number
  lng: number
  hasCapacity: boolean
  isUnmatched: boolean
  scheduledHoursPerWeek: number
  weeklyHourCap: number
  stateViable: boolean
  fullAddress: string
}

export type MapProximityResult = {
  client: {
    id: string
    name: string
    clientCode: string
    lat: number
    lng: number
    state: string | null
  }
  therapists: MapProximityTherapist[]
  message?: string
}
