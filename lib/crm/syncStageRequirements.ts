import { prisma } from '@/lib/prisma'
import type { ClientStage } from '@prisma/client'
import { CLIENT_STAGE_ORDER, REQUIREMENT_KEY_LABELS, STAGE_GATE_REQUIREMENT_KEYS } from '@/lib/crm/stages'
import { hoursBetween } from '@/lib/rbt-schedule/utils'

const KEY_HOME_STAGE: Partial<Record<string, ClientStage>> = {}
for (const stage of CLIENT_STAGE_ORDER) {
  for (const key of STAGE_GATE_REQUIREMENT_KEYS[stage]) {
    if (!KEY_HOME_STAGE[key]) KEY_HOME_STAGE[key] = stage
  }
}
KEY_HOME_STAGE.bcba_assigned = 'SCHEDULE_CONFIRMED'

/**
 * Maps live module state → `client_requirements` COMPLETE so Phase 2
 * `canAdvance` / `advanceStage` see the gates without forking gate logic.
 */
export async function syncStageRequirements(
  clientId: string,
  completedByUserId: string
): Promise<void> {
  const client = await prisma.serviceClient.findUnique({
    where: { id: clientId },
    include: {
      authorizations: { include: { lines: true } },
      btAssignments: { where: { status: 'ACTIVE' } },
      scheduleAssignments: { where: { isActive: true } },
      requirements: true,
    },
  })
  if (!client) return

  const keysToComplete = new Set<string>()

  const treatmentApproved = client.authorizations.find(
    (a) =>
      a.authType === 'TREATMENT' &&
      a.status === 'APPROVED' &&
      !!a.authNumber?.trim() &&
      a.lines.length > 0 &&
      !!a.effectiveDate &&
      !!a.expirationDate
  )
  if (treatmentApproved) {
    keysToComplete.add('auth_approved')
    keysToComplete.add('auth_packet_complete')
    keysToComplete.add('auth_submitted')
    if (treatmentApproved.renderingProvider?.trim()) {
      keysToComplete.add('rendering_provider_set')
    }
  }

  const assessmentApproved = client.authorizations.find(
    (a) => a.authType === 'ASSESSMENT' && a.status === 'APPROVED'
  )
  if (assessmentApproved) {
    keysToComplete.add('assessment_completed')
  }

  const assignedRbt = client.btAssignments.find(
    (b) => b.assignmentStage === 'ASSIGNED' && !!b.rbtProfileId
  )
  if (assignedRbt) {
    keysToComplete.add('rbt_assigned')
    keysToComplete.add('match_approved')
    keysToComplete.add('candidates_identified')
  } else if (client.btAssignments.some((b) => !!b.rbtProfileId)) {
    keysToComplete.add('candidates_identified')
  }

  if (client.bcbaProfileId) {
    keysToComplete.add('bcba_assigned')
  }

  const completeSlots = client.scheduleAssignments.filter(
    (s) =>
      s.dayOfWeek >= 0 &&
      s.dayOfWeek <= 6 &&
      !!s.startTime &&
      !!s.endTime &&
      hoursBetween(s.startTime, s.endTime) > 0 &&
      !!s.location?.trim() &&
      !!s.rbtProfileId
  )
  if (completeSlots.length > 0) {
    keysToComplete.add('schedule_proposed')
    keysToComplete.add('schedule_confirmed')
    keysToComplete.add('preferred_schedule_captured')
  }

  if (keysToComplete.size === 0) return

  const now = new Date()
  const byKey = new Map(client.requirements.map((r) => [r.key, r]))

  for (const key of keysToComplete) {
    const existing = byKey.get(key)
    if (existing) {
      if (
        existing.status === 'COMPLETE' ||
        existing.status === 'RECEIVED' ||
        existing.status === 'NOT_APPLICABLE'
      ) {
        continue
      }
      await prisma.clientRequirement.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETE',
          completedAt: now,
          completedByUserId,
        },
      })
      continue
    }

    const stage = KEY_HOME_STAGE[key]
    if (!stage) continue

    await prisma.clientRequirement.create({
      data: {
        serviceClientId: clientId,
        stage,
        key,
        label: REQUIREMENT_KEY_LABELS[key] ?? key.replace(/_/g, ' '),
        type: 'FIELD',
        status: 'COMPLETE',
        isRequiredToAdvance: true,
        completedAt: now,
        completedByUserId,
      },
    })
  }
}
