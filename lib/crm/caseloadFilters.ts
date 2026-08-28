import type { Prisma, ClientOwnerDept } from '@prisma/client'
import {
  PRE_ACTIVE_STAGES,
  STAFFING_STAGES,
  authExpiryBefore,
  contactAgingBefore,
  inquiryUncontactedBefore,
  stageStaleBefore,
  taskOverdueBefore,
} from '@/lib/crm/thresholds'
import type { ClientStage } from '@prisma/client'

/** Map dashboard `?queue=` deep-links to Prisma where clauses (merged with visibility scope). */
export function caseloadQueueWhere(
  queue: string,
  now = new Date()
): Prisma.ServiceClientWhereInput | null {
  const live: Prisma.ServiceClientWhereInput = { pipelineStatus: 'LIVE' }
  const exp60 = authExpiryBefore(60, now)

  switch (queue) {
    case 'pipeline':
      return { ...live, stage: { in: [...PRE_ACTIVE_STAGES] } }
    case 'staffing':
      return { ...live, stage: { in: [...STAFFING_STAGES] } }
    case 'active':
      return { ...live, stage: 'ACTIVE' }
    case 'on_hold':
      return { pipelineStatus: 'ON_HOLD' }
    case 'needs_attention':
      return {
        OR: [
          {
            ...live,
            stage: { not: 'ACTIVE' },
            OR: PRE_ACTIVE_STAGES.map((stage) => ({
              stage,
              stageEnteredAt: { lt: stageStaleBefore(stage, now) },
            })),
          },
          {
            alerts: { some: { resolvedAt: null } },
          },
          {
            teamTasks: {
              some: {
                status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
                dueAt: { lt: taskOverdueBefore(now) },
              },
            },
          },
        ],
      }
    case 'intake_uncontacted':
      return {
        ...live,
        stage: 'INQUIRY',
        OR: [
          { lastParentContactAt: null },
          { lastParentContactAt: { lt: inquiryUncontactedBefore(now) } },
        ],
      }
    case 'intake_missing_docs':
      return {
        ...live,
        requirements: {
          some: {
            type: 'DOCUMENT',
            status: { in: ['PENDING', 'MISSING', 'EXPIRED'] },
          },
        },
      }
    case 'clinical_assessment_overdue':
      return {
        ...live,
        stage: 'ASSESSMENT',
        stageEnteredAt: { lt: stageStaleBefore('ASSESSMENT', now) },
      }
    case 'clinical_treatment_plan_pending':
      return {
        ...live,
        treatmentPlanStatus: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        stage: {
          in: [
            'ASSESSMENT',
            'TREATMENT_PLAN',
            'AUTHORIZATION',
            'APPROVED',
            'READY_FOR_STAFFING',
            'RBT_SEARCH',
            'RBT_ASSIGNED',
            'SCHEDULE_COORDINATION',
            'SCHEDULE_CONFIRMED',
            'PRE_START',
          ],
        },
      }
    case 'auth_pending':
      return {
        ...live,
        OR: [
          { stage: 'AUTHORIZATION' },
          {
            authorizations: {
              some: { status: { in: ['REQUESTED', 'PENDING'] } },
            },
          },
        ],
      }
    case 'auth_denied':
      return {
        authorizations: { some: { status: 'DENIED' } },
      }
    case 'auth_expiring':
      return {
        ...live,
        stage: 'ACTIVE',
        authorizations: {
          some: {
            authType: 'TREATMENT',
            status: 'APPROVED',
            expirationDate: { lte: exp60, gte: now },
          },
        },
      }
    case 'schedule_start_pending':
      return {
        ...live,
        stage: { in: ['SCHEDULE_CONFIRMED', 'PRE_START'] },
        actualServiceStartDate: null,
      }
    case 'rbt_replacement':
      return {
        alerts: {
          some: {
            alertType: 'RBT_REPLACEMENT_NEEDED',
            resolvedAt: null,
          },
        },
      }
    case 'service_gaps':
      return {
        OR: [
          { pipelineStatus: 'ON_HOLD' },
          { serviceBreaks: { some: { status: 'ON_BREAK' } } },
          { rbtBreaks: { some: { status: 'ON_BREAK' } } },
        ],
      }
    default:
      return null
  }
}

export function isClientStage(value: string): value is ClientStage {
  return (
    PRE_ACTIVE_STAGES.includes(value as ClientStage) || value === 'ACTIVE'
  )
}

/** Caseload department queue lens → owner dept filter. */
export function caseloadDeptOwner(dept: string): ClientOwnerDept | null {
  switch (dept) {
    case 'intake':
      return 'INTAKE'
    case 'case-coordination':
      return 'CASE_COORDINATION'
    case 'billing':
      return 'BILLING'
    case 'clinical':
      return 'CLINICAL'
    case 'staffing':
      return 'STAFFING'
    default:
      return null
  }
}

export function caseloadDeptWhere(dept: string): Prisma.ServiceClientWhereInput | null {
  const owner = caseloadDeptOwner(dept)
  if (!owner) return null
  return { currentOwnerDept: owner }
}

export function contactAgingWhere(now = new Date()): Prisma.ServiceClientWhereInput {
  return {
    pipelineStatus: 'LIVE',
    OR: [
      { lastParentContactAt: null },
      { lastParentContactAt: { lt: contactAgingBefore(now) } },
    ],
  }
}
