import type { ClientStage } from '@prisma/client'
import { LINEAR_STAGE_ORDER } from '@/lib/crm/stages'

/** Expected max days in each stage before the case is considered stalled. */
export const STAGE_MAX_DAYS: Record<ClientStage, number> = {
  INQUIRY: 1,
  INTAKE: 3,
  CONSENT: 5,
  DOCUMENTS: 7,
  BENEFITS: 5,
  ASSESSMENT: 14,
  TREATMENT_PLAN: 10,
  AUTHORIZATION: 21,
  APPROVED: 3,
  READY_FOR_STAFFING: 5,
  RBT_SEARCH: 14,
  RBT_ASSIGNED: 5,
  SCHEDULE_COORDINATION: 7,
  SCHEDULE_CONFIRMED: 5,
  PRE_START: 7,
  ACTIVE: 9999,
}

/** Hours past dueAt before an open task counts as overdue. */
export const TASK_OVERDUE_GRACE_HOURS = 0

/** Days without parent contact before a LIVE client needs follow-up. */
export const CONTACT_AGING_DAYS = 7

/** Authorization/reassessment expiry attention bands (days remaining), descending. */
export const AUTH_EXPIRY_BANDS = [45, 30, 14, 7, 0] as const

export type AuthExpiryBand = (typeof AUTH_EXPIRY_BANDS)[number]

/** Open DOCUMENT requirements older than this → DOCS_MISSING alert. */
export const DOCS_MISSING_DAYS = 5

/** Unresolved RBT_REPLACEMENT_NEEDED older than this → escalate to URGENT. */
export const RBT_REPLACEMENT_ESCALATE_DAYS = 3

/** Days past expectedReturnDate before SERVICE_GAP fires (0 = same day). */
export const SERVICE_GAP_GRACE_DAYS = 0

export type StageAgingClient = {
  stage: ClientStage
  stageEnteredAt: Date | null | undefined
  /** When set and past, staffing stages escalate as stalled. */
  rbtTargetDate?: Date | null | undefined
}

/** Whole days spent in the current stage (0 if missing entered-at). */
export function daysInStage(client: StageAgingClient): number {
  if (!client.stageEnteredAt) return 0
  const ms = Date.now() - new Date(client.stageEnteredAt).getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

/** Stages where a missed rbtTargetDate counts as staffing escalation. */
const RBT_TARGET_STALL_STAGES: ReadonlySet<ClientStage> = new Set([
  'AUTHORIZATION',
  'APPROVED',
  'READY_FOR_STAFFING',
  'RBT_SEARCH',
])

/** True when days in stage exceed max, or RBT target date is past while still staffing. */
export function isStalled(client: StageAgingClient, now = new Date()): boolean {
  if (client.stage === 'ACTIVE') return false
  if (daysInStage(client) > STAGE_MAX_DAYS[client.stage]) return true
  if (
    client.rbtTargetDate &&
    RBT_TARGET_STALL_STAGES.has(client.stage) &&
    new Date(client.rbtTargetDate).getTime() < now.getTime()
  ) {
    return true
  }
  return false
}

export function stageStaleBefore(stage: ClientStage, now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - STAGE_MAX_DAYS[stage])
  return d
}

export function contactAgingBefore(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - CONTACT_AGING_DAYS)
  return d
}

export function inquiryUncontactedBefore(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d
}

export function authExpiryBefore(days: number, now = new Date()): Date {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  d.setDate(d.getDate() + days)
  return d
}

export function taskOverdueBefore(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(d.getHours() - TASK_OVERDUE_GRACE_HOURS)
  return d
}

/** Pipeline stages before ACTIVE (still in journey). */
export const PRE_ACTIVE_STAGES: ClientStage[] = LINEAR_STAGE_ORDER.filter(
  (s) => s !== 'ACTIVE'
)

export const STAFFING_STAGES: ClientStage[] = [
  'READY_FOR_STAFFING',
  'RBT_SEARCH',
  'RBT_ASSIGNED',
]

export const SCHEDULING_STAGES: ClientStage[] = [
  'SCHEDULE_COORDINATION',
  'SCHEDULE_CONFIRMED',
  'PRE_START',
]
