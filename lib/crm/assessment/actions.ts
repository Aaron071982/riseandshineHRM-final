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
import { isReassessment } from '@/lib/crm/assessment/assessmentType'
import { sectionsWithClientPrefill } from '@/lib/crm/assessment/prefill'
import { reassessmentIssues } from '@/lib/crm/assessment/reassessment'
import { createReassessmentRecord } from '@/lib/crm/assessment/reassessmentRecord'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'
import { copyAssessmentFile } from '@/lib/crm/assessment/storage'
import {
  buildAssessmentStoragePath,
  UPLOADED_PDF_SECTION_KEY,
} from '@/lib/crm/assessment/storagePaths'
import { Prisma } from '@prisma/client'

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

/**
 * Starts a reassessment by cloning every section (and attached graphs) of the
 * most recent completed in-app assessment into a new record linked by
 * previousAssessmentId. The predecessor is only read. Signatures, report dates
 * and status are not carried; goal performance rolls current → previous.
 */
export async function startTreatmentReassessment(
  serviceClientId: string,
  sourceAssessmentId?: string
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanEditTreatmentAssessment(user)
    await assertCanViewClient(user, serviceClientId)

    const baseWhere = { serviceClientId, deletedAt: null, source: 'FORM' as const }
    const source = sourceAssessmentId
      ? await prisma.clientTreatmentAssessment.findFirst({
          where: { ...baseWhere, id: sourceAssessmentId },
          include: { attachments: { where: { deletedAt: null } } },
        })
      : (await prisma.clientTreatmentAssessment.findFirst({
          where: { ...baseWhere, status: { in: ['COMPLETED', 'SIGNED'] } },
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
          include: { attachments: { where: { deletedAt: null } } },
        })) ??
        (await prisma.clientTreatmentAssessment.findFirst({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          include: { attachments: { where: { deletedAt: null } } },
        }))

    if (!source) {
      return {
        ok: false,
        error: 'No in-app assessment to copy from. Fill an initial assessment first.',
        status: 400,
      }
    }

    const created = await createReassessmentRecord(source, user.id)

    const attachments = source.attachments.filter(
      (a) => a.sectionKey !== UPLOADED_PDF_SECTION_KEY
    )
    if (attachments.length > 0) {
      const rows = await Promise.all(
        attachments.map(async (a) => {
          const copiedPath = await copyAssessmentFile(
            a.storagePath,
            buildAssessmentStoragePath({
              serviceClientId,
              assessmentId: created.id,
              sectionKey: a.sectionKey,
              fileName: a.fileName,
            })
          )
          return {
            assessmentId: created.id,
            sectionKey: a.sectionKey,
            kind: a.kind,
            storagePath: copiedPath ?? a.storagePath,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            uploadedByUserId: a.uploadedByUserId,
          }
        })
      )
      await prisma.clientTreatmentAssessmentAttachment.createMany({ data: rows })
    }

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId,
      assessmentId: created.id,
      action: 'CREATED',
      detail: `REASSESSMENT_FROM:${source.id}`,
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
      select: { id: true, serviceClientId: true, status: true, source: true, assessmentType: true },
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
      if (key === 'reassessment' && !isReassessment(assessment.assessmentType)) continue
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

/**
 * Reassessments with open checklist items (missing rationales, caregiver
 * training below minimum, …) complete only with an override reason, which is
 * written to the audit trail.
 */
export async function markTreatmentAssessmentComplete(
  assessmentId: string,
  opts?: { overrideReason?: string }
): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await getClientServicesUser()
    assertCanCompleteTreatmentAssessment(user)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
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

    let overrideDetail: string | undefined
    if (isReassessment(assessment.assessmentType)) {
      const issues = reassessmentIssues(parseAssessmentRecord(assessment))
      if (issues.length > 0) {
        const reason = opts?.overrideReason?.trim() ?? ''
        if (reason.length < 10) {
          return {
            ok: false,
            error: `Reassessment checklist has ${issues.length} open item${issues.length === 1 ? '' : 's'}: ${issues.map((i) => i.message).join(' ')}`,
            status: 400,
          }
        }
        overrideDetail = `OVERRIDE(${issues.length} open):${reason.slice(0, 300)}`
      }
    }

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
      detail: overrideDetail,
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
    if (assessment.status !== 'COMPLETED' && assessment.status !== 'SIGNED') {
      // Already editable (DRAFT / IN_PROGRESS)
      return { ok: true, assessmentId: assessment.id }
    }

    await assertCanViewClient(user, assessment.serviceClientId)

    await prisma.clientTreatmentAssessment.update({
      where: { id: assessmentId },
      data: {
        status: 'IN_PROGRESS',
        completedAt: null,
        signedAt: null,
        updatedByUserId: user.id,
      },
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: assessment.serviceClientId,
      assessmentId,
      action: 'UPDATED',
      detail: assessment.status === 'SIGNED' ? 'REOPENED_FROM_SIGNED' : 'REOPENED',
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
