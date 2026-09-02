import type { ClientStage } from '@prisma/client'
import { deriveMetricsForClients } from '@/lib/client-services/serviceStatus'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { STAFFING_STAGES } from '@/lib/crm/thresholds'
import { isReceivingUnderAuthorizedThreshold } from '@/lib/crm/staffingUnderHoursShared'
import { LIVE_SCHEDULE_ASSIGNMENT_WHERE } from '@/lib/crm/staffing/departure'
import { prisma } from '@/lib/prisma'

/** Why a client appears in the needs-staffing set (canonical map + queue definition). */
export type NeedsStaffingReason = 'unstaffed' | 'understaffed' | 'losing_staff_soon'

export type ClientStaffingSnapshot = {
  id: string
  stage: ClientStage
  staffingNeedsMoreHours: boolean
  authHours: number | null
  activeBtCount: number
  scheduledHoursPerWeek: number
  hasOpenReplacementFlag: boolean
}

export function classifyClientStaffingNeed(
  client: ClientStaffingSnapshot
): NeedsStaffingReason[] {
  const reasons: NeedsStaffingReason[] = []

  const inStaffingPipeline = (STAFFING_STAGES as readonly ClientStage[]).includes(
    client.stage
  )
  const activeUnassigned =
    client.stage === 'ACTIVE' && client.activeBtCount === 0

  if (inStaffingPipeline || activeUnassigned) {
    reasons.push('unstaffed')
  }

  if (client.stage === 'ACTIVE') {
    if (client.staffingNeedsMoreHours) {
      reasons.push('understaffed')
    } else if (
      isReceivingUnderAuthorizedThreshold(
        client.scheduledHoursPerWeek,
        client.authHours
      )
    ) {
      reasons.push('understaffed')
    }
  }

  if (client.hasOpenReplacementFlag) {
    reasons.push('losing_staff_soon')
  }

  return reasons
}

export function clientNeedsStaffing(client: ClientStaffingSnapshot): boolean {
  return classifyClientStaffingNeed(client).length > 0
}

/**
 * Canonical needs-staffing set: unstaffed ∪ understaffed ∪ losing-staff-soon.
 * Used by the staffing map, weekly digest, and Ask-the-HRM bot.
 */
export async function getClientsNeedingStaffing(): Promise<
  Map<string, NeedsStaffingReason[]>
> {
  const [clients, replacementClientIds] = await Promise.all([
    prisma.serviceClient.findMany({
      where: {
        ...NOT_DELETED,
        pipelineStatus: 'LIVE',
      },
      select: {
        id: true,
        stage: true,
        staffingNeedsMoreHours: true,
        authHours: true,
        status: true,
        btAssignments: {
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { btName: true },
        },
      },
    }),
    prisma.rbtScheduleAssignment.findMany({
      where: {
        ...LIVE_SCHEDULE_ASSIGNMENT_WHERE,
        needsReplacement: true,
        replacementResolvedAt: null,
        serviceClientId: { not: null },
      },
      select: { serviceClientId: true },
      distinct: ['serviceClientId'],
    }),
  ])

  const replacementSet = new Set(
    replacementClientIds
      .map((r) => r.serviceClientId)
      .filter((id): id is string => !!id)
  )

  const activeForMetrics = clients.filter((c) => c.stage === 'ACTIVE')
  const metrics = await deriveMetricsForClients(
    activeForMetrics.map((c) => ({
      id: c.id,
      status: c.status,
      authHours: c.authHours,
      btAssignments: c.btAssignments,
    }))
  )

  const out = new Map<string, NeedsStaffingReason[]>()

  for (const c of clients) {
    const scheduledHoursPerWeek =
      c.stage === 'ACTIVE' ? (metrics.get(c.id)?.scheduledHoursPerWeek ?? 0) : 0
    const snapshot: ClientStaffingSnapshot = {
      id: c.id,
      stage: c.stage,
      staffingNeedsMoreHours: c.staffingNeedsMoreHours,
      authHours: c.authHours,
      activeBtCount: c.btAssignments.length,
      scheduledHoursPerWeek,
      hasOpenReplacementFlag: replacementSet.has(c.id),
    }
    const reasons = classifyClientStaffingNeed(snapshot)
    if (reasons.length) out.set(c.id, reasons)
  }

  return out
}
