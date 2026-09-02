import 'server-only'

import {
  assertCanViewClient,
  getVisibleClientsWhere,
} from '@/lib/crm/access'
import {
  hasCompletedTreatmentAssessment,
} from '@/lib/crm/assessment/load'
import {
  getOrCreateCurrentClinicalAssessment,
  missingAssessmentArtifactTypes,
} from '@/lib/crm/clinicalAssessment/storage'
import { getMcpCrmUser } from '@/lib/mcp/crmUser'
import { jsonToolResult, paginate } from '@/lib/mcp/format'
import type { ToolResult } from '@/lib/mcp/types'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { prisma } from '@/lib/prisma'

async function resolveClientId(client: string): Promise<string> {
  const q = client.trim()
  const user = await getMcpCrmUser()
  const row = await prisma.serviceClient.findFirst({
    where: {
      ...NOT_DELETED,
      ...getVisibleClientsWhere(user),
      OR: [{ id: q }, { clientCode: { equals: q, mode: 'insensitive' } }],
    },
    select: { id: true },
  })
  if (!row) throw new Error(`Client not found: ${client}`)
  return row.id
}

export async function getAssessmentStatus(args: {
  client: string
}): Promise<ToolResult> {
  const clientId = await resolveClientId(args.client)
  const user = await getMcpCrmUser()
  await assertCanViewClient(user, clientId)

  const [clinical, treatmentComplete, treatmentList] = await Promise.all([
    getOrCreateCurrentClinicalAssessment({
      clientId,
      userId: user.id,
    }),
    hasCompletedTreatmentAssessment(clientId),
    prisma.clientTreatmentAssessment.findMany({
      where: { serviceClientId: clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        assessmentType: true,
        reportDate: true,
        completedAt: true,
        signedAt: true,
      },
    }),
  ])

  const missingClinical = missingAssessmentArtifactTypes(clinical.artifacts)

  const latestTreatment = treatmentList[0] ?? null

  const payload = {
    clientId,
    clinical: {
      assessmentId: clinical.id,
      lockState: clinical.lockState,
      captureMode: clinical.captureMode,
      missingArtifacts: missingClinical,
      createdAt: clinical.createdAt.toISOString(),
      lockedAt: clinical.lockedAt?.toISOString() ?? null,
    },
    treatment: {
      hasCompleted: treatmentComplete,
      latest: latestTreatment
        ? {
            id: latestTreatment.id,
            status: latestTreatment.status,
            assessmentType: latestTreatment.assessmentType,
            reportDate: latestTreatment.reportDate?.toISOString().slice(0, 10) ?? null,
            completedAt: latestTreatment.completedAt?.toISOString() ?? null,
            signedAt: latestTreatment.signedAt?.toISOString() ?? null,
          }
        : null,
    },
  }

  return jsonToolResult('Assessment status', payload, {
    clientId,
    clinicalLockState: clinical.lockState,
    treatmentStatus: latestTreatment?.status ?? null,
  })
}

export async function listAssessments(args: {
  status?: string
  started_after?: string
  limit?: number
  cursor?: string
}): Promise<ToolResult> {
  const user = await getMcpCrmUser()
  const where = {
    deletedAt: null,
    serviceClient: { ...NOT_DELETED, ...getVisibleClientsWhere(user) },
    ...(args.status?.trim()
      ? { status: args.status.trim().toUpperCase() as 'DRAFT' | 'COMPLETED' | 'SIGNED' }
      : {}),
    ...(args.started_after
      ? { createdAt: { gte: new Date(args.started_after) } }
      : {}),
  }

  const rows = await prisma.clientTreatmentAssessment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      assessmentType: true,
      reportDate: true,
      completedAt: true,
      signedAt: true,
      createdAt: true,
      serviceClient: {
        select: {
          id: true,
          clientCode: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  const mapped = rows.map((r) => ({
    id: r.id,
    clientId: r.serviceClient.id,
    clientCode: r.serviceClient.clientCode,
    clientName: `${r.serviceClient.firstName} ${r.serviceClient.lastName}`.trim(),
    status: r.status,
    assessmentType: r.assessmentType,
    reportDate: r.reportDate?.toISOString().slice(0, 10) ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    signedAt: r.signedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }))

  const { page, nextCursor, total } = paginate(
    mapped,
    args.limit ?? 25,
    args.cursor
  )

  return jsonToolResult(
    'Treatment assessments',
    { total, nextCursor, assessments: page },
    { count: page.length, total, nextCursor }
  )
}
