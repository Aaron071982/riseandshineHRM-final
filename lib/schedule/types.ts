import type { ScheduleDayOfWeek, ScheduleSlotStatus, ScheduleTherapistRole } from '@prisma/client'

export type ScheduleTherapist = {
  id: string
  name: string
  email: string | null
  role: ScheduleTherapistRole
  colorKey: number | null
  active: boolean
}

export type ScheduleClient = {
  id: string
  code: string | null
  name: string
  insurance: string | null
  bcba: string | null
  authorizedHoursPerWeek: number | null
  active: boolean
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

export type ViewMode = 'roster' | 'table' | 'hours'
export type RowDimension = 'therapist' | 'client'
