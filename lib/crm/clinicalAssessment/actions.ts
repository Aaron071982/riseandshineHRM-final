'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  assertCanViewClient,
  auditClientAction,
  getClientServicesUser,
} from '@/lib/crm/access'
import { requireDestructiveConfirm } from '@/lib/crm/serverConfirm'
import {
  assertCanLockClinicalAssessment,
  assertCanUnlockClinicalAssessment,
  assertCanUploadClinicalAssessmentArtifacts,
  assertCanViewClinicalAssessment,
} from '@/lib/crm/clinicalAssessment/access'
import {
  getOrCreateCurrentClinicalAssessment,
} from '@/lib/crm/clinicalAssessment/storage'
import { missingAssessmentArtifactTypes } from '@/lib/crm/clinicalAssessment/artifacts.shared'
import { saveAssessmentDetailsRecord } from '@/lib/crm/clinicalAssessment/details'
import type {
  AssessmentDetailsInput,
  AssessmentDetailsRecord,
} from '@/lib/crm/clinicalAssessment/details.shared'
import type { ActionResult } from '@/lib/crm/actions'

function revalidateClient(clientId: string) {
  revalidatePath(`/client-services/clients/${clientId}`)
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof Error) {
    return { ok: false, error: err.message, status: 500 }
  }
  return { ok: false, error: 'Something went wrong', status: 500 }
}

export async function lockClinicalAssessment(
  assessmentId: string,
  opts?: { confirmed?: boolean }
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanLockClinicalAssessment(user)
    requireDestructiveConfirm(
      opts?.confirmed,
      'Lock assessment requires confirmed: true — locked records are immutable'
    )

    const assessment = await prisma.clientClinicalAssessment.findFirst({
      where: { id: assessmentId, isCurrentVersion: true, lockState: 'DRAFT' },
      include: { artifacts: { where: { deletedAt: null } } },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found or already locked', status: 404 }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    const missing = missingAssessmentArtifactTypes(assessment.artifacts)
    if (missing.length > 0) {
      return {
        ok: false,
        error: 'Upload the initial assessment report before locking',
        status: 400,
      }
    }

    const now = new Date()
    await prisma.clientClinicalAssessment.update({
      where: { id: assessment.id },
      data: {
        lockState: 'LOCKED',
        lockedAt: now,
        lockedByUserId: user.id,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      action: `ASSESSMENT_LOCKED:v${assessment.versionNumber}`,
    })

    revalidateClient(assessment.serviceClientId)
    return { ok: true, assessmentId: assessment.id }
  } catch (err) {
    return fail(err)
  }
}

export async function unlockClinicalAssessment(
  assessmentId: string,
  opts?: { confirmed?: boolean; reason?: string | null }
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanUnlockClinicalAssessment(user)
    requireDestructiveConfirm(
      opts?.confirmed,
      'Unlock assessment requires confirmed: true'
    )

    const assessment = await prisma.clientClinicalAssessment.findFirst({
      where: { id: assessmentId, isCurrentVersion: true, lockState: 'LOCKED' },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found or not locked', status: 404 }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    const reason = opts?.reason?.trim() || null
    if (!reason) {
      return { ok: false, error: 'Unlock reason is required', status: 400 }
    }

    const now = new Date()
    await prisma.clientClinicalAssessment.update({
      where: { id: assessment.id },
      data: {
        lockState: 'DRAFT',
        unlockedAt: now,
        unlockedByUserId: user.id,
        unlockReason: reason,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      action: `ASSESSMENT_UNLOCKED:v${assessment.versionNumber}`,
    })

    revalidateClient(assessment.serviceClientId)
    return { ok: true, assessmentId: assessment.id }
  } catch (err) {
    return fail(err)
  }
}

export async function createClinicalAssessmentVersion(
  clientId: string,
  opts?: { confirmed?: boolean }
): Promise<ActionResult<{ assessmentId: string; versionNumber: number }>> {
  try {
    const user = await getClientServicesUser()
    assertCanUploadClinicalAssessmentArtifacts(user)
    requireDestructiveConfirm(
      opts?.confirmed,
      'Create new assessment version requires confirmed: true'
    )
    await assertCanViewClient(user, clientId)

    const current = await prisma.clientClinicalAssessment.findFirst({
      where: { serviceClientId: clientId, isCurrentVersion: true },
    })
    if (!current) {
      const created = await getOrCreateCurrentClinicalAssessment({
        clientId,
        userId: user.id,
      })
      return {
        ok: true,
        assessmentId: created.id,
        versionNumber: created.versionNumber,
      }
    }
    if (current.lockState !== 'LOCKED') {
      return {
        ok: false,
        error: 'Lock the current version before creating a correction version',
        status: 400,
      }
    }

    const now = new Date()
    const nextVersion = current.versionNumber + 1
    const created = await prisma.$transaction(async (tx) => {
      await tx.clientClinicalAssessment.update({
        where: { id: current.id },
        data: { isCurrentVersion: false, supersededAt: now },
      })
      return tx.clientClinicalAssessment.create({
        data: {
          serviceClientId: clientId,
          versionNumber: nextVersion,
          isCurrentVersion: true,
          createdByUserId: user.id,
          details: { create: {} },
        },
      })
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `ASSESSMENT_VERSION_CREATED:v${nextVersion}`,
    })

    revalidateClient(clientId)
    return {
      ok: true,
      assessmentId: created.id,
      versionNumber: created.versionNumber,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function auditClinicalAssessmentView(clientId: string): Promise<void> {
  const user = await getClientServicesUser()
  assertCanViewClinicalAssessment(user)
  await assertCanViewClient(user, clientId)
  await auditClientAction({
    userId: user.id,
    serviceClientId: clientId,
    action: 'ASSESSMENT_VIEW',
  })
}

export async function saveClinicalAssessmentDetails(
  clientId: string,
  assessmentId: string,
  payload: AssessmentDetailsInput
): Promise<ActionResult<{ details: AssessmentDetailsRecord }>> {
  try {
    const user = await getClientServicesUser()
    assertCanUploadClinicalAssessmentArtifacts(user)
    await assertCanViewClient(user, clientId)

    const assessment = await prisma.clientClinicalAssessment.findFirst({
      where: {
        id: assessmentId,
        serviceClientId: clientId,
        isCurrentVersion: true,
      },
      select: { id: true, lockState: true },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found', status: 404 }
    }
    if (assessment.lockState !== 'DRAFT') {
      return { ok: false, error: 'Assessment is locked', status: 400 }
    }

    const details = await saveAssessmentDetailsRecord({
      assessmentId,
      clientId,
      userId: user.id,
      payload,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'ASSESSMENT_DETAILS_SAVED',
    })

    revalidateClient(clientId)
    return { ok: true, details }
  } catch (err) {
    return fail(err)
  }
}
