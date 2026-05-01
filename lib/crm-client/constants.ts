/** CRM client lifecycle (cms_clients.status). */
export const CRM_CLIENT_STATUSES = ['NEW_INTAKE', 'WAITING', 'ACTIVE', 'INACTIVE'] as const
export type CrmClientStatus = (typeof CRM_CLIENT_STATUSES)[number]

export const ASSIGNMENT_STATUSES = ['ACTIVE', 'ENDED', 'ON_HOLD'] as const

export const CLIENT_NOTE_TYPES = [
  'GENERAL',
  'CLINICAL',
  'BILLING',
  'SCHEDULING',
  'FOLLOW_UP',
] as const
export type ClientNoteType = (typeof CLIENT_NOTE_TYPES)[number]

export function isCrmClientStatus(s: string): s is CrmClientStatus {
  return (CRM_CLIENT_STATUSES as readonly string[]).includes(s)
}
