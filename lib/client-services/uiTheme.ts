import type { ServiceBoardBucket } from '@/lib/client-services/serviceStatus'

/** Light health-dashboard status colors — used everywhere in Client Services UI. */
export const CS_STATUS_COLORS = {
  NEEDS_RBT: { bg: '#FCEBEB', text: '#A32D2D', border: '#A32D2D' },
  NEEDS_ADDITIONAL_HOURS: { bg: '#FAEEDA', text: '#854F0B', border: '#854F0B' },
  CLIENT_ON_BREAK: { bg: '#EEEDFE', text: '#3C3489', border: '#3C3489' },
  RBT_ON_BREAK: { bg: '#EEEDFE', text: '#3C3489', border: '#3C3489' },
  RECEIVING_SERVICES: { bg: '#E1F5EE', text: '#0F6E56', border: '#0F6E56' },
  NEW_INTAKE: { bg: '#E6F1FB', text: '#185FA5', border: '#185FA5' },
  ON_HOLD_DISCHARGED: { bg: '#F1F3F5', text: '#5F6B7A', border: '#5F6B7A' },
  SCHEDULE_UNLINKED: { bg: '#FAEEDA', text: '#854F0B', border: '#854F0B' },
} as const satisfies Record<
  ServiceBoardBucket,
  { bg: string; text: string; border: string }
>

export const CS_ACCENT = {
  bg: '#E6F1FB',
  text: '#185FA5',
  solid: '#378ADD',
  border: '#185FA5',
} as const

export const BOARD_BUCKET_LABELS: Record<ServiceBoardBucket, string> = {
  NEEDS_RBT: 'Needs RBT',
  NEEDS_ADDITIONAL_HOURS: 'Needs hours',
  CLIENT_ON_BREAK: 'On break',
  RBT_ON_BREAK: 'RBT on break',
  RECEIVING_SERVICES: 'Receiving services',
  NEW_INTAKE: 'New / Intake',
  ON_HOLD_DISCHARGED: 'On hold / Discharged',
  SCHEDULE_UNLINKED: 'Not linked to schedule',
}

export function initials(firstName: string, lastName: string): string {
  const a = (firstName || '').trim().charAt(0)
  const b = (lastName || '').trim().charAt(0)
  return `${a}${b}`.toUpperCase() || '?'
}

export function statusStyle(bucket: ServiceBoardBucket | string | undefined) {
  const key = (bucket || 'ON_HOLD_DISCHARGED') as ServiceBoardBucket
  return CS_STATUS_COLORS[key] ?? CS_STATUS_COLORS.ON_HOLD_DISCHARGED
}
