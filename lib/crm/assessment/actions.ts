'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  assertCanViewClient,
  getClientServicesUser,
} from '@/lib/crm/access'
import type { ActionResult } from '@/lib/crm/actions'
import {
  assertCanCompleteTreatmentAssessment,
  assertCanDeleteTreatmentAssessment,
  assertCanEditTreatmentAssessment,
  assertCanUploadTreatmentAssessmentFiles,
  assertCanViewTreatmentAssessment,
} from '@/lib/crm/assessment/access'
import { auditTreatmentAssessmentAction } from '@/lib/crm/assessment/audit'
import {
  assessmentSectionSchemas,
  defaultAssessmentSections,
  safeParseAssessmentPatch,
  type AssessmentSectionKey,
} from '@/lib/crm/assessment/assessment.schema'
import { sectionsWithClientPrefill } from '@/lib/crm/assessment/prefill'
import { UPLOADED_PDF_SECTION_KEY } from '@/lib/crm/assessment/storagePaths'
import type { Prisma } from '@prisma/client'

function revalidateAssessmentPaths(serviceClientId: string, assessmentId?: string) {
  revalidatePath(`/client-services/clients/${serviceClientId}`)
  revalidatePath(`/client-services/clients/${serviceClientId}/assessments`)
  if (assessmentId) {
    revalidatePath(
      `/client-services/clients/${serviceClientId}/assessments/${assessmentId}`
    )
  }
}

function fail(err: unknown): ActionResult<never> {
  if (err instanceof Error) {
    return { ok: false, error: err.message, status: 500 }
  }
  return { ok: false, error: 'Something went wrong', status: 500 }
}

function sectionJson(
  sections: ReturnType<typeof defaultAssessmentSections>
): Pick<
  Prisma.ClientTreatmentAssessmentUncheckedCreateInput,
  | 'summary'
  | 'treatmentRequest'
  | 'locationSchedule'
  | 'bioPsychosocial'
  | 'instruments'
  | 'presentLevels'
  | 'environmental'
  | 'responseToTx'
  | 'interventions'
  | 'behaviors'
  | 'goals'
  | 'parentTraining'
  | 'servicesProtocols'
  | 'transitionPlan'
  | 'coordination'
  | 'recommendations'
  | 'crisisPlan'
  | 'signatures'
> {
  return {
    summary: sections.summary,
    treatmentRequest: sections.treatmentRequest,
    locationSchedule: sections.locationSchedule,
    bioPsychosocial: sections.bioPsychosocial,
    instruments: sections.instruments,
    presentLevels: sections.presentLevels,
    environmental: sections.environmental,
    responseToTx: sections.responseToTx,
    interventions: sections.interventions,
    behaviors: sections.behaviors,
    goals: sections.goals,
    parentTraining: sections.parentTraining,
    servicesProtocols: sections.servicesProtocols,
    transitionPlan: sections.transitionPlan,
    coordination: sections.coordination,
    recommendations: sections.recommendations,
    crisisPlan: sections.crisisPlan,
    signatures: sections.signatures,
  }
}

export async function createTreatmentAssessmentForm(
  serviceClientId: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanEditTreatmentAssessment(user)
    await assertCanViewClient(user, serviceClientId)

    const client = await prisma.serviceClient.findFirst({
      where: { id: serviceClientId, deletedAt: null },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        parentName: true,
        diagnosis: true,
        referringProvider: true,
      },
    })
    if (!client) {
      return { ok: false, error: 'Client not found', status: 404 }
    }

    const sections = sectionsWithClientPrefill(client)
    const created = await prisma.clientTreatmentAssessment.create({
      data: {
        serviceClientId,
        status: 'DRAFT',
        source: 'FORM',
        createdByUserId: user.id,
        ...sectionJson(sections),
      },
      select: { id: true },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId,
      assessmentId: created.id,
      action: 'CREATED',
      detail: 'FORM',
    })

    revalidateAssessmentPaths(serviceClientId, created.id)
    return { ok: true, assessmentId: created.id }
  } catch (err) {
    return fail(err)
  }
}

export async function finalizeTreatmentAssessmentUpload(input: {
  serviceClientId: string
  assessmentId: string
}): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanUploadTreatmentAssessmentFiles(user)
    await assertCanViewClient(user, input.serviceClientId)

    const attachment = await prisma.clientTreatmentAssessmentAttachment.findFirst({
      where: {
        assessmentId: input.assessmentId,
        deletedAt: null,
        sectionKey: UPLOADED_PDF_SECTION_KEY,
        kind: 'PDF',
      },
    })
    if (!attachment) {
      return { ok: false, error: 'Upload a completed PDF first', status: 400 }
    }

    const now = new Date()
    await prisma.clientTreatmentAssessment.update({
      where: { id: input.assessmentId },
      data: {
        status: 'COMPLETED',
        source: 'UPLOAD',
        completedAt: now,
        updatedByUserId: user.id,
      },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: input.serviceClientId,
      assessmentId: input.assessmentId,
      action: 'COMPLETED',
      detail: 'UPLOAD',
    })

    revalidateAssessmentPaths(input.serviceClientId, input.assessmentId)
    return { ok: true, assessmentId: input.assessmentId }
  } catch (err) {
    return fail(err)
  }
}

export async function createTreatmentAssessmentUploadShell(
  serviceClientId: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanUploadTreatmentAssessmentFiles(user)
    await assertCanViewClient(user, serviceClientId)

    const created = await prisma.clientTreatmentAssessment.create({
      data: {
        serviceClientId,
        status: 'DRAFT',
        source: 'UPLOAD',
        createdByUserId: user.id,
      },
      select: { id: true },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId,
      assessmentId: created.id,
      action: 'CREATED',
      detail: 'UPLOAD',
    })

    revalidateAssessmentPaths(serviceClientId, created.id)
    return { ok: true, assessmentId: created.id }
  } catch (err) {
    return fail(err)
  }
}

export async function patchTreatmentAssessment(
  assessmentId: string,
  patch: unknown,
  opts?: { autosave?: boolean }
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanEditTreatmentAssessment(user)

    const parsed = safeParseAssessmentPatch(patch)
    if (!parsed.success) {
      return { ok: false, error: 'Invalid section data', status: 400 }
    }

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true, serviceClientId: true, status: true, source: true },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found', status: 404 }
    }
    if (assessment.status === 'SIGNED') {
      return { ok: false, error: 'Signed assessments are read-only', status: 400 }
    }
    if (assessment.source === 'UPLOAD') {
      return { ok: false, error: 'Uploaded assessments cannot be edited in-app', status: 400 }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    const data: Prisma.ClientTreatmentAssessmentUncheckedUpdateInput = {
      updatedByUserId: user.id,
    }
    if (assessment.status === 'DRAFT') {
      data.status = 'IN_PROGRESS'
    }

    for (const key of Object.keys(parsed.data) as AssessmentSectionKey[]) {
      const value = parsed.data[key]
      if (value !== undefined) {
        ;(data as Record<string, unknown>)[key] = value
      }
    }

    const updated = await prisma.clientTreatmentAssessment.update({
      where: { id: assessmentId },
      data,
      select: { updatedAt: true },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      assessmentId,
      action: opts?.autosave ? 'AUTOSAVED' : 'UPDATED',
    })

    revalidateAssessmentPaths(assessment.serviceClientId, assessmentId)
    return { ok: true, updatedAt: updated.updatedAt.toISOString() }
  } catch (err) {
    return fail(err)
  }
}

export async function saveTreatmentAssessmentSection(
  assessmentId: string,
  sectionKey: AssessmentSectionKey,
  data: unknown
): Promise<ActionResult<{ updatedAt: string }>> {
  const schema = assessmentSectionSchemas[sectionKey]
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: `Invalid ${sectionKey} data`, status: 400 }
  }
  return patchTreatmentAssessment(assessmentId, { [sectionKey]: parsed.data })
}

export async function markTreatmentAssessmentComplete(
  assessmentId: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanCompleteTreatmentAssessment(user)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true, serviceClientId: true, status: true, source: true },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found', status: 404 }
    }
    if (assessment.source === 'UPLOAD') {
      return { ok: false, error: 'Uploaded assessments are completed on upload', status: 400 }
    }
    if (assessment.status === 'COMPLETED' || assessment.status === 'SIGNED') {
      return { ok: true, assessmentId: assessment.id }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    const now = new Date()
    await prisma.clientTreatmentAssessment.update({
      where: { id: assessmentId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        updatedByUserId: user.id,
      },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      assessmentId,
      action: 'COMPLETED',
    })

    revalidateAssessmentPaths(assessment.serviceClientId, assessmentId)
    return { ok: true, assessmentId }
  } catch (err) {
    return fail(err)
  }
}

export async function reopenTreatmentAssessment(
  assessmentId: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanCompleteTreatmentAssessment(user)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true, serviceClientId: true, status: true, source: true },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found', status: 404 }
    }
    if (assessment.source === 'UPLOAD') {
      return {
        ok: false,
        error: 'Uploaded assessments cannot be reopened for in-app editing',
        status: 400,
      }
    }
    if (assessment.status === 'SIGNED') {
      return {
        ok: false,
        error: 'Signed assessments cannot be reopened',
        status: 400,
      }
    }
    if (assessment.status !== 'COMPLETED') {
      return { ok: true, assessmentId: assessment.id }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    await prisma.clientTreatmentAssessment.update({
      where: { id: assessmentId },
      data: {
        status: 'IN_PROGRESS',
        completedAt: null,
        updatedByUserId: user.id,
      },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      assessmentId,
      action: 'UPDATED',
      detail: 'REOPENED',
    })

    revalidateAssessmentPaths(assessment.serviceClientId, assessmentId)
    return { ok: true, assessmentId }
  } catch (err) {
    return fail(err)
  }
}

export async function signTreatmentAssessment(
  assessmentId: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanCompleteTreatmentAssessment(user)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true, serviceClientId: true, status: true },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found', status: 404 }
    }
    if (assessment.status !== 'COMPLETED' && assessment.status !== 'SIGNED') {
      return {
        ok: false,
        error: 'Assessment must be completed before signing',
        status: 400,
      }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    const now = new Date()
    await prisma.clientTreatmentAssessment.update({
      where: { id: assessmentId },
      data: {
        status: 'SIGNED',
        signedAt: now,
        updatedByUserId: user.id,
      },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      assessmentId,
      action: 'SIGNED',
    })

    revalidateAssessmentPaths(assessment.serviceClientId, assessmentId)
    return { ok: true, assessmentId }
  } catch (err) {
    return fail(err)
  }
}

export async function softDeleteTreatmentAssessment(
  assessmentId: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanDeleteTreatmentAssessment(user)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true, serviceClientId: true },
    })
    if (!assessment) {
      return { ok: false, error: 'Assessment not found', status: 404 }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    await prisma.clientTreatmentAssessment.update({
      where: { id: assessmentId },
      data: { deletedAt: new Date(), updatedByUserId: user.id },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      assessmentId,
      action: 'DELETED',
    })

    revalidateAssessmentPaths(assessment.serviceClientId)
    return { ok: true, assessmentId }
  } catch (err) {
    return fail(err)
  }
}

export async function auditTreatmentAssessmentView(serviceClientId: string) {
  const user = await getClientServicesUser()
  assertCanViewTreatmentAssessment(user)
  await auditTreatmentAssessmentAction({
    userId: user.id,
    serviceClientId,
    assessmentId: 'list',
    action: 'UPDATED',
    detail: 'VIEW',
  })
}
