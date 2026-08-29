import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  assertCanViewClient,
  getClientServicesUser,
} from '@/lib/crm/access'
import {
  assertCanViewTreatmentAssessment,
  canEditTreatmentAssessment,
  canUploadTreatmentAssessmentFiles,
} from '@/lib/crm/assessment/access'
import type { TreatmentAssessmentStatus, TreatmentAssessmentSource } from '@prisma/client'

export type TreatmentAssessmentListItem = {
  id: string
  status: TreatmentAssessmentStatus
  source: TreatmentAssessmentSource
  assessmentType: string
  reportDate: Date | null
  completedAt: Date | null
  signedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdByUser: { id: string; name: string | null; email: string }
}

export async function listTreatmentAssessments(serviceClientId: string) {
  const user = await getClientServicesUser()
  assertCanViewTreatmentAssessment(user)
  await assertCanViewClient(user, serviceClientId)

  return prisma.clientTreatmentAssessment.findMany({
    where: { serviceClientId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      source: true,
      assessmentType: true,
      reportDate: true,
      completedAt: true,
      signedAt: true,
      createdAt: true,
      updatedAt: true,
      createdByUser: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function hasCompletedTreatmentAssessment(
  serviceClientId: string
): Promise<boolean> {
  const row = await prisma.clientTreatmentAssessment.findFirst({
    where: {
      serviceClientId,
      deletedAt: null,
      status: { in: ['COMPLETED', 'SIGNED'] },
    },
    select: { id: true },
  })
  return !!row
}

export async function loadTreatmentAssessmentDetail(
  serviceClientId: string,
  assessmentId: string
) {
  const user = await getClientServicesUser()
  assertCanViewTreatmentAssessment(user)
  await assertCanViewClient(user, serviceClientId)

  const assessment = await prisma.clientTreatmentAssessment.findFirst({
    where: {
      id: assessmentId,
      serviceClientId,
      deletedAt: null,
    },
    include: {
      attachments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      },
      createdByUser: { select: { id: true, name: true, email: true } },
      updatedByUser: { select: { id: true, name: true, email: true } },
    },
  })

  if (!assessment) return null

  return {
    assessment,
    permissions: {
      canEdit: canEditTreatmentAssessment(user),
      canUpload: canUploadTreatmentAssessmentFiles(user),
    },
  }
}

export async function loadTreatmentAssessmentForPrint(
  serviceClientId: string,
  assessmentId: string
) {
  const user = await getClientServicesUser()
  assertCanViewTreatmentAssessment(user)
  await assertCanViewClient(user, serviceClientId)

  const client = await prisma.serviceClient.findFirst({
    where: { id: serviceClientId, deletedAt: null },
    select: {
      id: true,
      clientCode: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
    },
  })
  if (!client) return null

  const assessment = await prisma.clientTreatmentAssessment.findFirst({
    where: {
      id: assessmentId,
      serviceClientId,
      deletedAt: null,
    },
    include: {
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!assessment) return null

  return { client, assessment }
}
