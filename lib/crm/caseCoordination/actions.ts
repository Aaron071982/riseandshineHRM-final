'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  assertCanViewClient,
  getClientServicesUser,
} from '@/lib/crm/access'
import type { ActionResult } from '@/lib/crm/actions'
import { getClientIpFromHeaders } from '@/lib/client-ip'
import {
  assertCanConfirmCaseCoordination,
  assertCanEditCaseCoordination,
  assertCanViewCaseCoordination,
  canConfirmCaseCoordination,
  canEditCaseCoordination,
} from '@/lib/crm/caseCoordination/access'
import { auditCaseCoordinationAction } from '@/lib/crm/caseCoordination/audit'
import {
  getOrCreateCaseCoordinationRecord,
  loadCaseCoordinationForClient,
} from '@/lib/crm/caseCoordination/load'
import {
  mergeCaseCoordinationOverrides,
  parseCaseCoordinationOverrides,
  type CaseCoordinationOverrides,
} from '@/lib/crm/caseCoordination/schema'
import { generateCaseCoordinationPdf } from '@/lib/crm/caseCoordination/generatePdf'
import {
  buildCaseCoordinationPdfPath,
} from '@/lib/crm/caseCoordination/storagePaths'
import { uploadCaseCoordinationPdf } from '@/lib/crm/caseCoordination/storage'
import {
  resolveCaseCoordinationDocument,
  snapshotCaseCoordinationPayload,
} from '@/lib/crm/caseCoordination/resolve'

function revalidateCaseCoordinationPaths(serviceClientId: string) {
  revalidatePath(`/client-services/clients/${serviceClientId}`)
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof Error) return { ok: false, error: err.message, status: 500 }
  return { ok: false, error: 'Something went wrong', status: 500 }
}

export async function ensureCaseCoordinationRecord(
  serviceClientId: string
): Promise<ActionResult<{ recordId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanViewCaseCoordination(user)
    await assertCanViewClient(user, serviceClientId)

    const record = await getOrCreateCaseCoordinationRecord(serviceClientId, user.id)
    const hdrs = await headers()
    await auditCaseCoordinationAction({
      userId: user.id,
      serviceClientId,
      action: 'VIEW',
      ip: getClientIpFromHeaders(hdrs),
    })

    return { ok: true, recordId: record.id }
  } catch (err) {
    return fail(err)
  }
}

export async function patchCaseCoordinationOverrides(input: {
  serviceClientId: string
  recordId: string
  patch: CaseCoordinationOverrides
}): Promise<ActionResult<{ recordId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanEditCaseCoordination(user)
    await assertCanViewClient(user, input.serviceClientId)

    const record = await prisma.clientCaseCoordination.findFirst({
      where: {
        id: input.recordId,
        serviceClientId: input.serviceClientId,
        deletedAt: null,
      },
    })
    if (!record) return { ok: false, error: 'Record not found', status: 404 }
    if (record.status === 'CONFIRMED') {
      return { ok: false, error: 'Confirmed records cannot be edited', status: 400 }
    }

    const current = parseCaseCoordinationOverrides(record.overrides)
    const merged = mergeCaseCoordinationOverrides(current, input.patch)

    await prisma.clientCaseCoordination.update({
      where: { id: record.id },
      data: {
        overrides: merged as Prisma.InputJsonValue,
        updatedByUserId: user.id,
      },
    })

    const hdrs = await headers()
    await auditCaseCoordinationAction({
      userId: user.id,
      serviceClientId: input.serviceClientId,
      action: 'OVERRIDE_SAVE',
      ip: getClientIpFromHeaders(hdrs),
    })

    revalidateCaseCoordinationPaths(input.serviceClientId)
    return { ok: true, recordId: record.id }
  } catch (err) {
    return fail(err)
  }
}

export async function confirmCaseCoordination(input: {
  serviceClientId: string
  recordId: string
}): Promise<ActionResult<{ recordId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanConfirmCaseCoordination(user)
    await assertCanViewClient(user, input.serviceClientId)

    const record = await prisma.clientCaseCoordination.findFirst({
      where: {
        id: input.recordId,
        serviceClientId: input.serviceClientId,
        deletedAt: null,
      },
    })
    if (!record) return { ok: false, error: 'Record not found', status: 404 }
    if (record.status === 'CONFIRMED') {
      return { ok: true, recordId: record.id }
    }

    const overrides = parseCaseCoordinationOverrides(record.overrides)
    const document = await resolveCaseCoordinationDocument(
      input.serviceClientId,
      overrides
    )
    if (!document) {
      return { ok: false, error: 'Could not resolve document data', status: 400 }
    }

    const snapshot = snapshotCaseCoordinationPayload(document)
    const nextOverrides = { ...overrides, snapshot }

    const client = await prisma.serviceClient.findFirst({
      where: { id: input.serviceClientId, deletedAt: null },
      select: { clientCode: true },
    })
    const pdfBytes = await generateCaseCoordinationPdf(snapshot)
    const pdfPath = buildCaseCoordinationPdfPath({
      serviceClientId: input.serviceClientId,
      recordId: record.id,
      clientCode: client?.clientCode ?? undefined,
    })
    await uploadCaseCoordinationPdf({ storagePath: pdfPath, bytes: pdfBytes })

    await prisma.clientCaseCoordination.update({
      where: { id: record.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedByUserId: user.id,
        updatedByUserId: user.id,
        overrides: nextOverrides as Prisma.InputJsonValue,
        pdfPath,
      },
    })

    const hdrs = await headers()
    await auditCaseCoordinationAction({
      userId: user.id,
      serviceClientId: input.serviceClientId,
      action: 'CONFIRM',
      ip: getClientIpFromHeaders(hdrs),
    })
    await auditCaseCoordinationAction({
      userId: user.id,
      serviceClientId: input.serviceClientId,
      action: `PDF_STORED:${pdfPath}`,
      ip: getClientIpFromHeaders(hdrs),
    })

    revalidateCaseCoordinationPaths(input.serviceClientId)
    return { ok: true, recordId: record.id }
  } catch (err) {
    return fail(err)
  }
}

export async function loadCaseCoordinationPanelData(serviceClientId: string) {
  const user = await getClientServicesUser()
  assertCanViewCaseCoordination(user)
  await assertCanViewClient(user, serviceClientId)

  await getOrCreateCaseCoordinationRecord(serviceClientId, user.id)
  const { record, document } = await loadCaseCoordinationForClient(serviceClientId)

  const hdrs = await headers()
  await auditCaseCoordinationAction({
    userId: user.id,
    serviceClientId,
    action: 'PREVIEW',
    ip: getClientIpFromHeaders(hdrs),
  })

  return {
    canEdit: canEditCaseCoordination(user),
    canConfirm: canConfirmCaseCoordination(user),
    record,
    document,
  }
}
