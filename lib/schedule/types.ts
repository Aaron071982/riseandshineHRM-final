import type { ScheduleDayOfWeek, ScheduleSlotStatus, ScheduleTherapistRole } from '@prisma/client'
import type { ClientStage } from '@prisma/client'

export type ScheduleTherapist = {
  id: string
  name: string
  email: string | null
  role: ScheduleTherapistRole
  borough: string | null
  colorKey: number | null
  active: boolean
  /** Home address from the RBT profile, single line. */
  address?: string | null
}

export type ScheduleClient = {
  id: string
  code: string | null
  name: string
  borough: string | null
  insurance: string | null
  bcba: string | null
  authorizedHoursPerWeek: number | null
  active: boolean
  stage: ClientStage | null
  /** Service address from the client record, single line. */
  address?: string | null
}

export type ScheduleSlot = {
  id: string
  therapistId: string
  clientId: string
  day: ScheduleDayOfWeek
  startMin: number
  endMin: number
  status: ScheduleSlotStatus
  procedureCode: string
  placeOfService: string
  note: string | null
  createdBy: string | null
  updatedBy: string | null
}

export type ScheduleWorkspaceData = {
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  allowedEmails: string[]
  allowedUsers: { id: string; email: string }[]
}

export type ViewMode = 'roster' | 'table' | 'hours' | 'constellation'
export type RowDimension = 'therapist' | 'client'
