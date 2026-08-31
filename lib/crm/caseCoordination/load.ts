import 'server-only'

import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import {
  applyCaseCoordinationOverrides,
  readConfirmedSnapshot,
  resolveCaseCoordinationDocument,
  type CaseCoordinationDocumentPayload,
} from '@/lib/crm/caseCoordination/resolve'
import { parseCaseCoordinationOverrides } from '@/lib/crm/caseCoordination/schema'

export async function getOrCreateCaseCoordinationRecord(
  serviceClientId: string,
  createdByUserId: string
) {
  const existing = await prisma.clientCaseCoordination.findFirst({
    where: { serviceClientId, ...NOT_DELETED },
    orderBy: { updatedAt: 'desc' },
  })
  if (existing) return existing

  return prisma.clientCaseCoordination.create({
    data: {
      serviceClientId,
      createdByUserId,
      status: 'DRAFT',
    },
  })
}

export async function loadCaseCoordinationForClient(serviceClientId: string) {
  const record = await prisma.clientCaseCoordination.findFirst({
    where: { serviceClientId, ...NOT_DELETED },
    orderBy: { updatedAt: 'desc' },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      confirmedByUser: { select: { id: true, name: true, email: true } },
    },
  })

  if (!record) {
    return {
      record: null,
      document: await resolveCaseCoordinationDocument(serviceClientId, null),
    }
  }

  const overrides = parseCaseCoordinationOverrides(record.overrides)
  let document: CaseCoordinationDocumentPayload | null

  if (record.status === 'CONFIRMED') {
    const snapshot = readConfirmedSnapshot(record.overrides)
    document =
      snapshot ??
      (await resolveCaseCoordinationDocument(serviceClientId, overrides))
  } else {
    const live = await resolveCaseCoordinationDocument(serviceClientId, overrides)
    document = live
      ? applyCaseCoordinationOverrides(live, overrides)
      : null
  }

  return { record, document }
}

export async function loadCaseCoordinationById(id: string, serviceClientId: string) {
  const record = await prisma.clientCaseCoordination.findFirst({
    where: { id, serviceClientId, ...NOT_DELETED },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      confirmedByUser: { select: { id: true, name: true, email: true } },
    },
  })
  if (!record) return null

  const overrides = parseCaseCoordinationOverrides(record.overrides)
  const snapshot = readConfirmedSnapshot(record.overrides)
  const document =
    record.status === 'CONFIRMED' && snapshot
      ? snapshot
      : await resolveCaseCoordinationDocument(serviceClientId, overrides)

  return { record, document }
}
