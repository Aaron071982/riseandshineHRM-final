import type { ClientTreatmentAssessment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isReassessment } from '@/lib/crm/assessment/assessmentType'
import { buildReassessmentClone } from '@/lib/crm/assessment/reassessment'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'

/**
 * Inserts a DRAFT reassessment cloned from `source`. Only reads the source.
 * Callers own access checks, attachment copies and audit logging.
 */
export async function createReassessmentRecord(
  source: ClientTreatmentAssessment,
  userId: string
): Promise<{ id: string }> {
  const previousSections = parseAssessmentRecord(source)
  const cloned = buildReassessmentClone(previousSections, {
    previousWasReassessment: isReassessment(source.assessmentType),
    previousReportDate:
      previousSections.summary.reportDate ||
      (source.reportDate ? source.reportDate.toISOString().slice(0, 10) : ''),
  })

  return prisma.clientTreatmentAssessment.create({
    data: {
      serviceClientId: source.serviceClientId,
      status: 'DRAFT',
      source: 'FORM',
      assessmentType: 'REASSESSMENT',
      previousAssessmentId: source.id,
      reportDate: null,
      createdByUserId: userId,
      summary: cloned.summary,
      treatmentRequest: cloned.treatmentRequest,
      locationSchedule: cloned.locationSchedule,
      bioPsychosocial: cloned.bioPsychosocial,
      instruments: cloned.instruments,
      presentLevels: cloned.presentLevels,
      environmental: cloned.environmental,
      responseToTx: cloned.responseToTx,
      interventions: cloned.interventions,
      behaviors: cloned.behaviors,
      goals: cloned.goals,
      parentTraining: cloned.parentTraining,
      servicesProtocols: cloned.servicesProtocols,
      transitionPlan: cloned.transitionPlan,
      coordination: cloned.coordination,
      recommendations: cloned.recommendations,
      crisisPlan: cloned.crisisPlan,
      signatures: cloned.signatures,
      reassessment: cloned.reassessment,
    },
    select: { id: true },
  })
}
