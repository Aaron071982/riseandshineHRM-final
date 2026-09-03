import type { NeedsStaffingReason } from '@/lib/crm/staffing/needsStaffing'
import type { PostHireStage, RBTStatus } from '@prisma/client'
import type { StageGroupId } from '@/lib/crm/stages'

export type TherapistMarkerColor = 'green' | 'red'
export type ClientMarkerColor = StageGroupId

export type MapTherapistEntity = {
  entityType: 'therapist'
  id: string
  name: string
  status: RBTStatus
  postHireStage: PostHireStage | null
  markerColor: TherapistMarkerColor
  markerHex: string
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
  stageGroup: StageGroupId
  markerColor: ClientMarkerColor
  markerHex: string
  needsStaffing: boolean
  needsStaffingReasons: NeedsStaffingReason[]
  statusLabel: string
  state: string | null
  city: string | null
  lat: number
  lng: number
  assignments: MapClientAssignment[]
}

export type ExcludedMapEntity = {
  entityType: 'therapist' | 'client'
  id: string
  name: string
  addressSummary: string
  reason: string
}

export type TherapistClientMapData = {
  therapists: MapTherapistEntity[]
  clients: MapClientEntity[]
  assignmentPairs: MapAssignmentPair[]
  excluded: ExcludedMapEntity[]
  stats: {
    therapistTotal: number
    therapistMapped: number
    clientTotal: number
    clientMapped: number
    clientsNeedingStaffing: number
    excludedCount: number
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
