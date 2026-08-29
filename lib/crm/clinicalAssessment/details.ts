import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  mapAssessmentDetailsRow,
  normalizeAssessmentDetailsInput,
  type AssessmentDetailsInput,
  type AssessmentDetailsRecord,
} from '@/lib/crm/clinicalAssessment/details.shared'

export async function getOrCreateAssessmentDetails(
  assessmentId: string
): Promise<AssessmentDetailsRecord> {
  const existing = await prisma.clientClinicalAssessmentDetails.findUnique({
    where: { assessmentId },
  })
  if (existing) return mapAssessmentDetailsRow(existing)

  const created = await prisma.clientClinicalAssessmentDetails.create({
    data: { assessmentId },
  })
  return mapAssessmentDetailsRow(created)
}

export async function saveAssessmentDetailsRecord(input: {
  assessmentId: string
  clientId: string
  userId: string
  payload: AssessmentDetailsInput
}): Promise<AssessmentDetailsRecord> {
  const assessment = await prisma.clientClinicalAssessment.findFirst({
    where: {
      id: input.assessmentId,
      serviceClientId: input.clientId,
      lockState: 'DRAFT',
    },
    select: { id: true },
  })
  if (!assessment) {
    throw new Error('Assessment is locked or not found')
  }

  const normalized = normalizeAssessmentDetailsInput(input.payload)
  const data: Prisma.ClientClinicalAssessmentDetailsUpdateInput = {
    ...normalized,
    locations: normalized.locations,
    riskFactors: normalized.riskFactors,
    goalAreas: normalized.goalAreas,
    updatedByUser: { connect: { id: input.userId } },
  }

  const row = await prisma.clientClinicalAssessmentDetails.upsert({
    where: { assessmentId: input.assessmentId },
    create: {
      assessmentId: input.assessmentId,
      ...normalized,
      updatedByUserId: input.userId,
    },
    update: data,
  })

  return mapAssessmentDetailsRow(row)
}

export async function ensureAssessmentDetailsForAssessment(
  assessmentId: string
): Promise<void> {
  await prisma.clientClinicalAssessmentDetails.upsert({
    where: { assessmentId },
    create: { assessmentId },
    update: {},
  })
}
