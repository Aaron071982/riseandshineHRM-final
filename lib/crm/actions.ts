'use server'

import type {
  AssignmentStage,
  AuthStatus,
  AuthDenialClass,
  AuthType,
  ClientPipelineStatus,
  ClientReferralSource,
  ClientStage,
  CommChannel,
  CommDirection,
  CommTemplate,
  EthnicityPreference,
  GenderPreference,
  MilestoneStatus,
  RequirementStatus,
  ServiceBtAssignmentStatus,
  ServiceClientStatus,
} from '@prisma/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import {
  assertCanEditClient,
  auditClientAction,
  CrmAccessError,
  getClientServicesUser,
  isFullAccess,
  getRequestIp,
  rethrowIfNextControlFlow,
} from '@/lib/crm/access'
import {
  canAdvance,
  canSetRbtTargetDate,
  nextStage,
  REQUIREMENT_KEY_LABELS,
  STAGE_DEFAULT_OWNER_DEPT,
  STAGE_GATE_REQUIREMENT_KEYS,
} from '@/lib/crm/stages'
import { isValidCpt, cptLabel } from '@/lib/crm/cpt'
import {
  CANONICAL_DOCUMENTS,
  computeExpiresAt,
  DOCUMENT_BY_KEY,
  isDocumentRequired,
  isMedicaidPayer,
} from '@/lib/crm/documents'
import {
  computeConsentBillingReady,
  consentExpiresAt,
  parseConsentLines,
  type ConsentLineKey,
  type ConsentLinesMap,
} from '@/lib/crm/consent'
import { evaluateReferralValidity } from '@/lib/crm/referralValidity'
import { PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT } from '@/lib/esign-constants'
import { syncStageRequirements } from '@/lib/crm/syncStageRequirements'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'
import { restoreData, softDeleteData } from '@/lib/crm/softDelete'
import { ownershipPatchOnDeptChange } from '@/lib/crm/claims'
import { authorizedHoursWarning } from '@/lib/schedule/hoursCheck'
import { computeSessionBillability } from '@/lib/schedule/billability'
import { hoursBetween } from '@/lib/rbt-schedule/utils'
import { CRM_SCHEDULE_PATH } from '@/lib/schedule/paths'

function revalidateClient(clientId: string) {
  revalidatePath(`/client-services/clients/${clientId}`)
  revalidatePath('/client-services')
}

function pipelineToLegacyStatus(pipeline: ClientPipelineStatus): ServiceClientStatus {
  switch (pipeline) {
    case 'ON_HOLD':
      return 'ON_HOLD'
    case 'DISCHARGED':
    case 'LOST':
      return 'DISCHARGED'
    case 'LIVE':
    default:
      return 'ACTIVE'
  }
}

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; blocked?: boolean; blockedBy?: string[]; status?: number }

function fail(err: unknown): { ok: false; error: string; status?: number } {
  rethrowIfNextControlFlow(err)
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  if (err instanceof z.ZodError) {
    return { ok: false, error: err.issues[0]?.message ?? 'Invalid input', status: 400 }
  }
  console.error('[crm] action failed', err)
  return { ok: false, error: 'Something went wrong' }
}

const ConsentLinesPatchSchema = z
  .record(z.string().min(1), z.boolean())
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one consent line is required',
  })

const ScheduleEntryUpdateSchema = z
  .object({
    rbtProfileId: z.string().min(1).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    location: z.string().max(120).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => {
    if (!v.startTime || !v.endTime) return true
    return v.startTime < v.endTime
  }, 'endTime must be after startTime')

export async function updateClientNextAction(
  clientId: string,
  input: { nextAction: string | null; dueAt: string | null }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        nextAction: input.nextAction?.trim() || null,
        nextActionDueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'STATUS_CHANGE',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function advanceStage(clientId: string): Promise<
  ActionResult<{ stage: ClientStage } | { blocked: true; blockedBy: string[] }>
> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      include: {
        requirements: { where: { deletedAt: null } },
        consent: true,
        referralCheck: true,
      },
    })

    const consentLive =
      client.consent && !client.consent.deletedAt ? client.consent : null
    const referralLive =
      client.referralCheck && !client.referralCheck.deletedAt
        ? client.referralCheck
        : null
    const referralEval = evaluateReferralValidity(referralLive)
    const gate = canAdvance(
      {
        stage: client.stage,
        treatmentPlanStatus: client.treatmentPlanStatus,
        consentBillingReady: consentLive?.billingReady ?? false,
        referralValid: referralEval.ok,
        requiresMedicaidReferral: isMedicaidPayer(client.insuranceProvider),
      },
      client.requirements
    )
    if (!gate.ok) {
      const referralHint =
        gate.blockedBy.includes('physician_referral_validity') &&
        referralEval.missing.length > 0
          ? ` Incomplete referral: ${referralEval.missing.join(', ')}.`
          : ''
      return {
        ok: false,
        error: `Requirements incomplete.${referralHint}`,
        blocked: true,
        blockedBy: gate.blockedBy,
      }
    }

    const toStage = nextStage(client.stage)
    if (!toStage) {
      return { ok: false, error: 'Already at final stage' }
    }

    const now = new Date()
    const durationSeconds = client.stageEnteredAt
      ? Math.max(0, Math.floor((now.getTime() - client.stageEnteredAt.getTime()) / 1000))
      : null
    const ownerPatch = ownershipPatchOnDeptChange({
      fromDept: client.currentOwnerDept,
      toDept: STAGE_DEFAULT_OWNER_DEPT[toStage],
      caseCoordinatorUserId: client.caseCoordinatorUserId,
    })

    await prisma.$transaction(async (tx) => {
      await tx.serviceClientStatusHistory.create({
        data: {
          serviceClientId: clientId,
          fromStage: client.stage,
          toStage,
          fromStatus: client.status,
          toStatus: toStage === 'ACTIVE' ? 'ACTIVE' : client.status,
          durationSeconds,
          reason: 'Stage advanced',
          changedBy: user.id,
        },
      })

      // Seed next-stage gate requirements if missing
      const nextKeys = STAGE_GATE_REQUIREMENT_KEYS[toStage]
      const existing = new Set(
        client.requirements.filter((r) => r.stage === toStage).map((r) => r.key)
      )
      for (const key of nextKeys) {
        if (existing.has(key)) continue
        const catalog = DOCUMENT_BY_KEY[key]
        await tx.clientRequirement.create({
          data: {
            serviceClientId: clientId,
            stage: catalog?.stage ?? toStage,
            key,
            label: catalog?.label ?? REQUIREMENT_KEY_LABELS[key] ?? key,
            type: catalog?.type ?? 'TASK',
            group: catalog?.group ?? 'STAGE',
            status: 'PENDING',
            isRequiredToAdvance: catalog
              ? isDocumentRequired(catalog, client.insuranceProvider)
              : true,
          },
        })
      }

      await tx.serviceClient.update({
        where: { id: clientId },
        data: {
          stage: toStage,
          stageEnteredAt: now,
          currentOwnerDept: ownerPatch.currentOwnerDept,
          ...(toStage === 'ACTIVE'
            ? {
                actualServiceStartDate: client.actualServiceStartDate ?? now,
                status: 'ACTIVE',
              }
            : {}),
          ...(ownerPatch.deptChanged
            ? { currentOwnerUserId: ownerPatch.currentOwnerUserId ?? null }
            : {}),
        },
      })
      if (ownerPatch.shouldReleaseClaimGrants) {
        await tx.clientClaim.updateMany({
          where: {
            serviceClientId: clientId,
            releasedAt: null,
            source: 'CLAIM',
          },
          data: { releasedAt: now, releasedByUserId: user.id },
        })
      }
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'STAGE_ADVANCE',
    })

    // Parent journey email (standby unless explicitly enabled).
    try {
      const { maybeSendJourneyEmail } = await import('@/lib/crm/emails/send')
      await maybeSendJourneyEmail(clientId, toStage, { actorUserId: user.id })
    } catch (emailErr) {
      console.error('[crm] journey email after advance failed', emailErr)
    }

    revalidateClient(clientId)
    return { ok: true, stage: toStage }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Full-access free stage override (any → any). Gates are intentionally not
 * checked here so imported / incomplete clients remain editable. Coordinators
 * cannot call this — they must use advanceStage (gated).
 */
export async function setStage(
  clientId: string,
  toStage: ClientStage,
  reason: string
): Promise<ActionResult<{ stage: ClientStage }>> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to override stage', 403)
    }
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      include: { consent: true },
    })

    if (client.stage === toStage) {
      return { ok: true, stage: toStage }
    }

    if (
      toStage === 'ACTIVE' &&
      client.treatmentPlanStatus !== 'COMPLETE'
    ) {
      return {
        ok: false,
        error: 'Treatment plan must be complete before Active',
        blocked: true,
        blockedBy: ['treatment_plan_complete'],
      }
    }

    const consentLive =
      client.consent && !client.consent.deletedAt ? client.consent : null
    if (toStage === 'ACTIVE' && !consentLive?.billingReady) {
      return {
        ok: false,
        error:
          'Consent Form 02 billing gate: 97151 (assessment) and 97153 (direct therapy) must be initialed',
        blocked: true,
        blockedBy: ['consent_billing_ready'],
      }
    }

    const now = new Date()
    const durationSeconds = client.stageEnteredAt
      ? Math.max(0, Math.floor((now.getTime() - client.stageEnteredAt.getTime()) / 1000))
      : null
    const ownerPatch = ownershipPatchOnDeptChange({
      fromDept: client.currentOwnerDept,
      toDept: STAGE_DEFAULT_OWNER_DEPT[toStage],
      caseCoordinatorUserId: client.caseCoordinatorUserId,
    })

    await prisma.$transaction(async (tx) => {
      await tx.serviceClientStatusHistory.create({
        data: {
          serviceClientId: clientId,
          fromStage: client.stage,
          toStage,
          fromStatus: client.status,
          toStatus: toStage === 'ACTIVE' ? 'ACTIVE' : client.status,
          durationSeconds,
          reason: reason.trim() || 'Manual stage change',
          changedBy: user.id,
        },
      })

      await tx.serviceClient.update({
        where: { id: clientId },
        data: {
          stage: toStage,
          stageEnteredAt: now,
          currentOwnerDept: ownerPatch.currentOwnerDept,
          ...(toStage === 'ACTIVE'
            ? {
                actualServiceStartDate: client.actualServiceStartDate ?? now,
                status: client.pipelineStatus === 'LIVE' ? 'ACTIVE' : client.status,
              }
            : {}),
          ...(ownerPatch.deptChanged
            ? { currentOwnerUserId: ownerPatch.currentOwnerUserId ?? null }
            : {}),
        },
      })
      if (ownerPatch.shouldReleaseClaimGrants) {
        await tx.clientClaim.updateMany({
          where: {
            serviceClientId: clientId,
            releasedAt: null,
            source: 'CLAIM',
          },
          data: { releasedAt: now, releasedByUserId: user.id },
        })
      }
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'STAGE_CHANGE',
    })
    revalidateClient(clientId)
    return { ok: true, stage: toStage }
  } catch (err) {
    return fail(err)
  }
}

export type CreateServiceClientInput = {
  clientCode?: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  addressLine?: string | null
  city?: string | null
  borough?: string | null
  state?: string | null
  zip?: string | null
  insuranceProvider?: string | null
  parentName?: string | null
  parentPhone?: string | null
  parentEmail?: string | null
  bcbaName?: string | null
  bcbaProfileId?: string | null
  referralSource?: ClientReferralSource | null
  preferredRbtGender?: GenderPreference | null
  preferredRbtEthnicities?: EthnicityPreference[]
}

/** Internal Add-Client — creates at INQUIRY with DOCUMENT requirements seeded. */
export async function createServiceClient(
  input: CreateServiceClientInput
): Promise<ActionResult<{ id: string; clientCode: string }>> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to create clients', 403)
    }

    const firstName = input.firstName?.trim()
    const lastName = input.lastName?.trim()
    if (!firstName || !lastName) {
      return { ok: false, error: 'First and last name are required' }
    }

    let clientCode = (input.clientCode ?? '').trim().toUpperCase()
    if (!clientCode) {
      const latest = await prisma.serviceClient.findMany({
        where: { clientCode: { startsWith: 'CC-' } },
        select: { clientCode: true },
        orderBy: { clientCode: 'desc' },
        take: 50,
      })
      let max = 0
      for (const row of latest) {
        const n = Number(row.clientCode.replace(/^CC-/i, ''))
        if (Number.isFinite(n) && n > max) max = n
      }
      clientCode = `CC-${String(max + 1).padStart(3, '0')}`
    }

    const existing = await prisma.serviceClient.findUnique({
      where: { clientCode },
    })
    if (existing) {
      return { ok: false, error: `Client code ${clientCode} already exists` }
    }

    const parseDate = (v?: string | null) => {
      if (!v) return null
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? null : d
    }

    const now = new Date()
    const inquiryKeys = STAGE_GATE_REQUIREMENT_KEYS.INQUIRY

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceClient.create({
        data: {
          clientCode,
          firstName,
          lastName,
          stage: 'INQUIRY',
          pipelineStatus: 'LIVE',
          status: 'NEW',
          stageEnteredAt: now,
          currentOwnerDept: STAGE_DEFAULT_OWNER_DEPT.INQUIRY,
          inquiryReceivedAt: now,
          referralSource: input.referralSource ?? 'OTHER',
          dateOfBirth: parseDate(input.dateOfBirth),
          addressLine: input.addressLine?.trim() || null,
          city: input.city?.trim() || null,
          borough: input.borough?.trim() || null,
          state: input.state?.trim() || null,
          zip: input.zip?.trim() || null,
          insuranceProvider: input.insuranceProvider?.trim() || null,
          parentName: input.parentName?.trim() || null,
          parentPhone: input.parentPhone?.trim() || null,
          parentEmail: input.parentEmail?.trim() || null,
          bcbaName: input.bcbaName?.trim() || null,
          bcbaProfileId: input.bcbaProfileId || null,
          preferredRbtGender: input.preferredRbtGender ?? null,
          preferredRbtEthnicities: input.preferredRbtEthnicities ?? [],
          treatmentPlanStatus: 'NOT_STARTED',
          createdBy: user.id,
        },
      })

      for (const doc of CANONICAL_DOCUMENTS) {
        await tx.clientRequirement.create({
          data: {
            serviceClientId: created.id,
            stage: doc.stage,
            key: doc.key,
            label: doc.label,
            type: doc.type,
            group: doc.group,
            status: 'PENDING',
            isRequiredToAdvance: isDocumentRequired(
              doc,
              created.insuranceProvider
            ),
          },
        })
      }

      for (const key of inquiryKeys) {
        await tx.clientRequirement.create({
          data: {
            serviceClientId: created.id,
            stage: 'INQUIRY',
            key,
            label: REQUIREMENT_KEY_LABELS[key] ?? key,
            type: 'TASK',
            status: 'PENDING',
            isRequiredToAdvance: true,
          },
        })
      }

      await tx.serviceClientStatusHistory.create({
        data: {
          serviceClientId: created.id,
          fromStage: null,
          toStage: 'INQUIRY',
          fromStatus: null,
          toStatus: 'NEW',
          reason: 'Client created',
          changedBy: user.id,
        },
      })

      return created
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: client.id,
      action: 'CREATE',
    })
    revalidatePath('/client-services')
    revalidatePath('/client-services/clients')
    return { ok: true, id: client.id, clientCode: client.clientCode }
  } catch (err) {
    return fail(err)
  }
}

export async function updateTreatmentPlanStatus(
  clientId: string,
  status: MilestoneStatus
): Promise<ActionResult<{ treatmentPlanStatus: MilestoneStatus }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const now = new Date()
    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        treatmentPlanStatus: status,
        treatmentPlanCompletedAt: status === 'COMPLETE' ? now : null,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'TREATMENT_PLAN_UPDATE',
    })
    revalidateClient(clientId)
    return { ok: true, treatmentPlanStatus: status }
  } catch (err) {
    return fail(err)
  }
}

export async function updateRbtTargetDate(
  clientId: string,
  date: string | null
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      select: { stage: true },
    })
    if (date && !canSetRbtTargetDate(client.stage)) {
      return {
        ok: false,
        error: 'RBT target date is available from Authorization onward',
      }
    }

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        rbtTargetDate: date ? new Date(date) : null,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'RBT_TARGET_DATE_UPDATE',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function updateClientPreferences(
  clientId: string,
  input: {
    preferredRbtGender?: GenderPreference | null
    preferredRbtEthnicities?: EthnicityPreference[]
  }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        ...(input.preferredRbtGender !== undefined
          ? { preferredRbtGender: input.preferredRbtGender }
          : {}),
        ...(input.preferredRbtEthnicities !== undefined
          ? { preferredRbtEthnicities: input.preferredRbtEthnicities }
          : {}),
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'PREFERENCES_UPDATE',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

const REFERRAL_SOURCES = new Set<ClientReferralSource>([
  'PHONE',
  'WEBSITE',
  'EMAIL',
  'REFERRAL',
  'SOCIAL_MEDIA',
  'PROVIDER',
  'COMMUNITY',
  'OTHER',
])

function parseOptionalDate(v?: string | null): Date | null {
  if (!v?.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export type UpdateClientOverviewInput = {
  dateOfBirth?: string | null
  addressLine?: string | null
  city?: string | null
  borough?: string | null
  state?: string | null
  zip?: string | null
  insuranceProvider?: string | null
  insuranceId?: string | null
  diagnosis?: string | null
  parentName?: string | null
  parentPhone?: string | null
  parentEmail?: string | null
  parentRelationship?: string | null
  bcbaName?: string | null
  caseCoordinatorName?: string | null
  referralSource?: ClientReferralSource | null
  inquiryReceivedAt?: string | null
  actualServiceStartDate?: string | null
  authHours?: string | null
}

export async function updateClientOverview(
  clientId: string,
  input: UpdateClientOverviewInput
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const trim = (v?: string | null) => {
      if (v == null) return null
      const t = v.trim()
      return t || null
    }

    if (
      input.referralSource != null &&
      !REFERRAL_SOURCES.has(input.referralSource)
    ) {
      return { ok: false, error: 'Invalid referral source' }
    }

    let authHours: number | null | undefined
    if (input.authHours !== undefined) {
      const raw = input.authHours?.trim() ?? ''
      if (raw === '') {
        authHours = null
      } else {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0 || n > 168) {
          return { ok: false, error: 'Authorized hours must be between 0 and 168' }
        }
        authHours = n
      }
    }

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        ...(input.dateOfBirth !== undefined
          ? { dateOfBirth: parseOptionalDate(input.dateOfBirth) }
          : {}),
        ...(input.addressLine !== undefined
          ? { addressLine: trim(input.addressLine) }
          : {}),
        ...(input.city !== undefined ? { city: trim(input.city) } : {}),
        ...(input.borough !== undefined ? { borough: trim(input.borough) } : {}),
        ...(input.state !== undefined ? { state: trim(input.state) } : {}),
        ...(input.zip !== undefined ? { zip: trim(input.zip) } : {}),
        ...(input.insuranceProvider !== undefined
          ? { insuranceProvider: trim(input.insuranceProvider) }
          : {}),
        ...(input.insuranceId !== undefined
          ? { insuranceId: trim(input.insuranceId) }
          : {}),
        ...(input.diagnosis !== undefined
          ? { diagnosis: trim(input.diagnosis) }
          : {}),
        ...(input.parentName !== undefined
          ? { parentName: trim(input.parentName) }
          : {}),
        ...(input.parentPhone !== undefined
          ? { parentPhone: trim(input.parentPhone) }
          : {}),
        ...(input.parentEmail !== undefined
          ? { parentEmail: trim(input.parentEmail) }
          : {}),
        ...(input.parentRelationship !== undefined
          ? { parentRelationship: trim(input.parentRelationship) }
          : {}),
        ...(input.bcbaName !== undefined
          ? { bcbaName: trim(input.bcbaName) }
          : {}),
        ...(input.caseCoordinatorName !== undefined
          ? { caseCoordinatorName: trim(input.caseCoordinatorName) }
          : {}),
        ...(input.referralSource !== undefined
          ? { referralSource: input.referralSource ?? 'OTHER' }
          : {}),
        ...(input.inquiryReceivedAt !== undefined
          ? { inquiryReceivedAt: parseOptionalDate(input.inquiryReceivedAt) }
          : {}),
        ...(input.actualServiceStartDate !== undefined
          ? {
              actualServiceStartDate: parseOptionalDate(
                input.actualServiceStartDate
              ),
            }
          : {}),
        ...(authHours !== undefined ? { authHours } : {}),
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'OVERVIEW_UPDATE',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

const SATISFIED: ReadonlySet<RequirementStatus> = new Set([
  'COMPLETE',
  'RECEIVED',
  'ON_FILE',
  'NOT_APPLICABLE',
])

function applyRequirementSatisfaction(opts: {
  key: string
  status: RequirementStatus
  userId: string
  now: Date
  fileUrl?: string | null
  expiresAtInput?: string | null
}): {
  status: RequirementStatus
  completedAt: Date | null
  completedByUserId: string | null
  attestedAt?: Date | null
  attestedByUserId?: string | null
  expiresAt?: Date | null
} {
  const catalog = DOCUMENT_BY_KEY[opts.key]
  if (opts.key === 'consent_form' && opts.status === 'ON_FILE') {
    throw new CrmAccessError(
      'Consent Form 02 cannot be marked on-file — upload or e-sign in-system',
      400
    )
  }
  if (opts.status === 'ON_FILE' && catalog && catalog.attestAllowed === false) {
    throw new CrmAccessError('This requirement cannot be attested on-file', 400)
  }

  const satisfied = SATISFIED.has(opts.status) && opts.status !== 'NOT_APPLICABLE'
  let expiresAt: Date | null | undefined
  if (opts.expiresAtInput !== undefined) {
    expiresAt = opts.expiresAtInput ? new Date(opts.expiresAtInput) : null
  } else if (satisfied) {
    expiresAt = computeExpiresAt(opts.key, opts.now) ?? undefined
  }

  return {
    status: opts.status,
    completedAt: SATISFIED.has(opts.status) ? opts.now : null,
    completedByUserId: SATISFIED.has(opts.status) ? opts.userId : null,
    attestedAt: opts.status === 'ON_FILE' ? opts.now : null,
    attestedByUserId: opts.status === 'ON_FILE' ? opts.userId : null,
    expiresAt,
  }
}

export async function updateRequirement(
  requirementId: string,
  input: {
    status: RequirementStatus
    fileUrl?: string | null
    expiresAt?: string | null
    notes?: string | null
  }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const existing = await prisma.clientRequirement.findUnique({
      where: { id: requirementId },
      select: { id: true, serviceClientId: true, status: true, key: true },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }

    await assertCanEditClient(user, existing.serviceClientId)

    const now = new Date()
    const sat = applyRequirementSatisfaction({
      key: existing.key,
      status: input.status,
      userId: user.id,
      now,
      fileUrl: input.fileUrl,
      expiresAtInput: input.expiresAt,
    })

    await prisma.clientRequirement.update({
      where: { id: requirementId },
      data: {
        status: sat.status,
        fileUrl: input.fileUrl === undefined ? undefined : input.fileUrl,
        expiresAt: sat.expiresAt === undefined ? undefined : sat.expiresAt,
        notes: input.notes === undefined ? undefined : input.notes,
        completedAt: sat.completedAt,
        completedByUserId: sat.completedByUserId,
        attestedAt: sat.attestedAt === undefined ? undefined : sat.attestedAt,
        attestedByUserId:
          sat.attestedByUserId === undefined ? undefined : sat.attestedByUserId,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'REQUIREMENT_UPDATE',
    })
    revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function attestRequirementOnFile(
  requirementId: string
): Promise<ActionResult> {
  return updateRequirement(requirementId, { status: 'ON_FILE' })
}

export async function markRequirementReceived(
  requirementId: string,
  fileUrl?: string | null
): Promise<ActionResult> {
  return updateRequirement(requirementId, {
    status: 'RECEIVED',
    fileUrl: fileUrl ?? undefined,
  })
}

async function upsertConsentRow(clientId: string) {
  const existing = await prisma.clientConsent.findUnique({
    where: { serviceClientId: clientId },
  })
  if (existing) return existing
  return prisma.clientConsent.create({
    data: {
      serviceClientId: clientId,
      lines: {},
    },
  })
}

export async function saveConsentInitials(
  clientId: string,
  linesPatch: Partial<Record<ConsentLineKey, boolean>>
): Promise<ActionResult<{ billingReady: boolean }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const row = await upsertConsentRow(clientId)
    const lines = parseConsentLines(row.lines)
    const parsedPatch = ConsentLinesPatchSchema.parse(linesPatch)
    const nowIso = new Date().toISOString()
    for (const [rawKey, on] of Object.entries(parsedPatch)) {
      if (!(rawKey in lines)) {
        return { ok: false, error: `Invalid consent line key: ${rawKey}`, status: 400 }
      }
      const key = rawKey as ConsentLineKey
      const prev = lines[key] ?? {
        initialed: false,
        initialedAt: null,
        initialedBy: null,
      }
      lines[key] = on
        ? {
            initialed: true,
            initialedAt: prev.initialedAt ?? nowIso,
            initialedBy: prev.initialedBy ?? user.id,
          }
        : { initialed: false, initialedAt: null, initialedBy: null }
    }
    const billingReady = computeConsentBillingReady(lines)

    await prisma.clientConsent.update({
      where: { id: row.id },
        data: {
          lines: lines as object,
          billingReady,
        },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'CONSENT_INITIALS_UPDATE',
    })
    revalidateClient(clientId)
    return { ok: true, billingReady }
  } catch (err) {
    return fail(err)
  }
}

export async function signClientConsent(
  clientId: string,
  input: {
    signedByName: string
    uetaConsentGiven: boolean
    secondParentRequired?: boolean
    secondParentName?: string | null
    witness: boolean
  }
): Promise<ActionResult<{ billingReady: boolean; expiresAt: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    if (!input.uetaConsentGiven) {
      throw new CrmAccessError('UETA / E-SIGN consent is required', 400)
    }
    const name = input.signedByName.trim()
    if (!name) throw new CrmAccessError('Signer name is required', 400)

    const row = await upsertConsentRow(clientId)
    const lines = parseConsentLines(row.lines)
    const billingReady = computeConsentBillingReady(lines)
    const now = new Date()
    const expiresAt = consentExpiresAt(now)
    const ip = await getRequestIp().catch(() => null)

    await prisma.$transaction(async (tx) => {
      await tx.clientConsent.update({
        where: { id: row.id },
        data: {
          signatureDate: now,
          expiresAt,
          signedByName: name,
          uetaConsentGiven: true,
          signatureMethod: 'TYPED_NAME',
          signedIp: ip,
          billingReady,
          secondParentRequired: input.secondParentRequired ?? false,
          secondParentName: input.secondParentName?.trim() || null,
          secondParentSignedAt: input.secondParentName?.trim() ? now : null,
          staffWitnessUserId: input.witness ? user.id : row.staffWitnessUserId,
          staffWitnessedAt: input.witness ? now : row.staffWitnessedAt,
        },
      })

      const consentReq = await tx.clientRequirement.findFirst({
        where: {
          serviceClientId: clientId,
          key: 'consent_form',
          deletedAt: null,
        },
      })
      if (consentReq) {
        await tx.clientRequirement.update({
          where: { id: consentReq.id },
          data: {
            status: 'RECEIVED',
            completedAt: now,
            completedByUserId: user.id,
            expiresAt,
            notes: `E-signed (${PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT.slice(0, 48)}…)`,
          },
        })
      }
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'CONSENT_ESIGN',
    })
    revalidateClient(clientId)
    return {
      ok: true,
      billingReady,
      expiresAt: expiresAt.toISOString(),
    }
  } catch (err) {
    return fail(err)
  }
}

export async function saveReferralCheck(
  clientId: string,
  input: {
    signedByRole: 'PHYSICIAN' | 'PSYCHOLOGIST' | 'PSYCH_NP' | 'PEDS_NP' | null
    hasAsdDx: boolean
    initialDxDate: string | null
    severitySupportLevel: string | null
    abaRequiredStatement: boolean
    dsm5ChecklistAttached: boolean
    notes?: string | null
  }
): Promise<ActionResult<{ okReferral: boolean; missing: string[] }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const payload = {
      signedByRole: input.signedByRole,
      hasAsdDx: input.hasAsdDx,
      initialDxDate: input.initialDxDate ? new Date(input.initialDxDate) : null,
      severitySupportLevel: input.severitySupportLevel?.trim() || null,
      abaRequiredStatement: input.abaRequiredStatement,
      dsm5ChecklistAttached: input.dsm5ChecklistAttached,
      notes: input.notes?.trim() || null,
      updatedByUserId: user.id,
    }
    const evalResult = evaluateReferralValidity(payload)

    await prisma.clientReferralCheck.upsert({
      where: { serviceClientId: clientId },
      create: { serviceClientId: clientId, ...payload },
      update: payload,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'REFERRAL_CHECK_UPDATE',
    })
    revalidateClient(clientId)
    return { ok: true, okReferral: evalResult.ok, missing: evalResult.missing }
  } catch (err) {
    return fail(err)
  }
}

export async function addClientNote(
  clientId: string,
  content: string
): Promise<ActionResult<{ noteId: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const trimmed = content.trim()
    if (!trimmed) return { ok: false, error: 'Note cannot be empty' }

    const note = await prisma.serviceClientNote.create({
      data: {
        serviceClientId: clientId,
        authorId: user.id,
        content: trimmed,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'NOTE_ADD',
    })
    revalidateClient(clientId)
    return { ok: true, noteId: note.id }
  } catch (err) {
    return fail(err)
  }
}

export async function logParentContact(
  clientId: string,
  input: { channel: CommChannel; note?: string }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const now = new Date()
    await prisma.$transaction([
      prisma.clientCommunication.create({
        data: {
          serviceClientId: clientId,
          template: 'MANUAL',
          channel: input.channel,
          direction: 'OUTBOUND',
          subject: 'Parent contact',
          body: input.note?.trim() || `Logged ${input.channel.toLowerCase()} contact`,
          sentByUserId: user.id,
          sentAt: now,
          status: 'LOGGED',
        },
      }),
      prisma.serviceClient.update({
        where: { id: clientId },
        data: { lastParentContactAt: now },
      }),
    ])

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'CONTACT_LOG',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function setPipelineStatus(
  clientId: string,
  status: ClientPipelineStatus,
  reason: string,
  expectedReturnDate?: string | null
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
    })

    if (client.pipelineStatus === status) {
      return { ok: true }
    }

    const now = new Date()
    const durationSeconds = client.stageEnteredAt
      ? Math.max(0, Math.floor((now.getTime() - client.stageEnteredAt.getTime()) / 1000))
      : null
    const legacyTo = pipelineToLegacyStatus(status)
    const reasonText = reason.trim() || `Pipeline → ${status}`

    await prisma.$transaction(async (tx) => {
      await tx.serviceClientStatusHistory.create({
        data: {
          serviceClientId: clientId,
          fromStatus: client.status,
          toStatus: legacyTo,
          fromStage: client.stage,
          toStage: client.stage,
          durationSeconds,
          reason: reasonText,
          changedBy: user.id,
        },
      })

      if (status === 'ON_HOLD') {
        const expected = expectedReturnDate
          ? new Date(expectedReturnDate)
          : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        await tx.clientServiceBreak.create({
          data: {
            serviceClientId: clientId,
            reason: 'OTHER',
            startDate: now,
            expectedReturnDate: expected,
            status: 'ON_BREAK',
            notes: reasonText,
            createdBy: user.id,
          },
        })
      }

      if (client.pipelineStatus === 'ON_HOLD' && status === 'LIVE') {
        await tx.clientServiceBreak.updateMany({
          where: { serviceClientId: clientId, status: 'ON_BREAK' },
          data: { status: 'RETURNED', actualReturnDate: now },
        })
      }

      await tx.serviceClient.update({
        where: { id: clientId },
        data: {
          pipelineStatus: status,
          // Do not change stage — on-hold/discharge don't reset the journey.
          status: legacyTo === 'ACTIVE' && client.stage !== 'ACTIVE' ? client.status : legacyTo,
        },
      })
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'STATUS_CHANGE',
    })
    if (status === 'DISCHARGED' || status === 'LOST') {
      await writeAuditLog({
        actorUserId: user.id,
        entityType: 'ServiceClient',
        entityId: clientId,
        action: 'UPDATE',
        before: { pipelineStatus: client.pipelineStatus },
        after: {
          pipelineStatus: status,
          reason: reasonText,
          action: status === 'LOST' ? 'MARK_LOST' : 'DISCHARGE',
        },
      })
    }
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

// ─── Phase 3: Authorization / Staffing / Schedule / Communications ───────────

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function searchRbtProfiles(query: string): Promise<
  ActionResult<{
    results: { id: string; name: string; email: string | null; status: string }[]
  }>
> {
  try {
    await getClientServicesUser()
    const q = query.trim()
    const results = await prisma.rBTProfile.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { artemisProviderName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 25,
    })
    return {
      ok: true,
      results: results.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
        email: r.email,
        status: r.status,
      })),
    }
  } catch (err) {
    return fail(err)
  }
}

export async function searchBcbaProfiles(query: string): Promise<
  ActionResult<{
    results: { id: string; name: string; email: string | null }[]
  }>
> {
  try {
    await getClientServicesUser()
    const q = query.trim()
    const results = await prisma.bCBAProfile.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
      take: 25,
    })
    return {
      ok: true,
      results: results.map((r) => ({
        id: r.id,
        name: r.fullName,
        email: r.email,
      })),
    }
  } catch (err) {
    return fail(err)
  }
}

export async function createAuthorization(
  clientId: string,
  input: {
    authType: AuthType
    payerPlan: string
    payerName?: string
    authNumber?: string | null
    status?: AuthStatus
    effectiveDate?: string | null
    expirationDate?: string | null
    serviceLocation?: string | null
    renderingProviderId?: string | null
    renderingProvider?: string | null
    submittedDate?: string | null
    decisionDate?: string | null
    denialReason?: string | null
    denialClass?: AuthDenialClass | null
    proofOfSubmissionDocId?: string | null
    payerCallLogRef?: string | null
    notes?: string | null
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)
    const payerPlan = input.payerPlan.trim()
    if (!payerPlan) return { ok: false, error: 'Payer plan is required' }

    const status = input.status ?? 'REQUESTED'
    const auth = await prisma.clientAuthorization.create({
      data: {
        serviceClientId: clientId,
        authType: input.authType,
        payerPlan,
        payerName: input.payerName?.trim() || payerPlan,
        authNumber: input.authNumber?.trim() || null,
        status,
        submittedDate: parseDate(input.submittedDate),
        decisionDate: parseDate(input.decisionDate),
        requestedAt: new Date(),
        approvedAt: status === 'APPROVED' ? new Date() : null,
        effectiveDate: parseDate(input.effectiveDate),
        expirationDate: parseDate(input.expirationDate),
        renderingProviderId: input.renderingProviderId?.trim() || null,
        renderingProvider: input.renderingProvider?.trim() || null,
        serviceLocation: input.serviceLocation?.trim() || null,
        denialReason: input.denialReason?.trim() || null,
        denialClass: input.denialClass ?? null,
        proofOfSubmissionDocId: input.proofOfSubmissionDocId?.trim() || null,
        payerCallLogRef: input.payerCallLogRef?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    })

    await syncStageRequirements(clientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'AUTH_CREATE',
    })
    revalidateClient(clientId)
    return { ok: true, id: auth.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateAuthorization(
  authorizationId: string,
  input: {
    payerPlan?: string
    payerName?: string
    authNumber?: string | null
    status?: AuthStatus
    effectiveDate?: string | null
    expirationDate?: string | null
    submittedDate?: string | null
    decisionDate?: string | null
    renderingProviderId?: string | null
    renderingProvider?: string | null
    serviceLocation?: string | null
    denialReason?: string | null
    denialClass?: AuthDenialClass | null
    proofOfSubmissionDocId?: string | null
    payerCallLogRef?: string | null
    notes?: string | null
  }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const existing = await prisma.clientAuthorization.findUnique({
      where: { id: authorizationId },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }
    await assertCanEditClient(user, existing.serviceClientId)

    const status = input.status
    const becomingApproved =
      status === 'APPROVED' && existing.status !== 'APPROVED'

    await prisma.clientAuthorization.update({
      where: { id: authorizationId },
      data: {
        ...(input.payerPlan !== undefined
          ? { payerPlan: input.payerPlan.trim() || null }
          : {}),
        ...(input.payerName !== undefined
          ? { payerName: input.payerName.trim() }
          : {}),
        ...(input.authNumber !== undefined
          ? { authNumber: input.authNumber?.trim() || null }
          : {}),
        ...(status !== undefined ? { status } : {}),
        ...(becomingApproved ? { approvedAt: new Date() } : {}),
        ...(input.submittedDate !== undefined
          ? { submittedDate: parseDate(input.submittedDate) }
          : {}),
        ...(input.decisionDate !== undefined
          ? { decisionDate: parseDate(input.decisionDate) }
          : {}),
        ...(input.effectiveDate !== undefined
          ? { effectiveDate: parseDate(input.effectiveDate) }
          : {}),
        ...(input.expirationDate !== undefined
          ? { expirationDate: parseDate(input.expirationDate) }
          : {}),
        ...(input.renderingProviderId !== undefined
          ? { renderingProviderId: input.renderingProviderId?.trim() || null }
          : {}),
        ...(input.renderingProvider !== undefined
          ? { renderingProvider: input.renderingProvider?.trim() || null }
          : {}),
        ...(input.serviceLocation !== undefined
          ? { serviceLocation: input.serviceLocation?.trim() || null }
          : {}),
        ...(input.denialReason !== undefined
          ? { denialReason: input.denialReason?.trim() || null }
          : {}),
        ...(input.denialClass !== undefined
          ? { denialClass: input.denialClass }
          : {}),
        ...(input.proofOfSubmissionDocId !== undefined
          ? { proofOfSubmissionDocId: input.proofOfSubmissionDocId?.trim() || null }
          : {}),
        ...(input.payerCallLogRef !== undefined
          ? { payerCallLogRef: input.payerCallLogRef?.trim() || null }
          : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
      },
    })

    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'AUTH_UPDATE',
    })
    revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function addAuthorizationLine(
  authorizationId: string,
  input: {
    cptCode: string
    authRequired?: boolean
    unitsRequested?: number | null
    unitsApproved?: number | null
    unitsAuthorized: number
    unitsUsed?: number
    description?: string | null
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getClientServicesUser()
    const auth = await prisma.clientAuthorization.findUnique({
      where: { id: authorizationId },
    })
    if (!auth) return { ok: false, error: 'Not found', status: 404 }
    await assertCanEditClient(user, auth.serviceClientId)

    if (!isValidCpt(input.cptCode)) {
      return { ok: false, error: 'Invalid CPT code' }
    }
    const unitsAuthorized = Math.max(0, Math.floor(input.unitsAuthorized))
    const unitsRequested =
      input.unitsRequested == null ? null : Math.max(0, Math.floor(input.unitsRequested))
    const unitsApproved =
      input.unitsApproved == null ? null : Math.max(0, Math.floor(input.unitsApproved))
    const unitsUsed = Math.max(0, Math.floor(input.unitsUsed ?? 0))
    const underApproved =
      unitsRequested != null &&
      unitsApproved != null &&
      unitsApproved < unitsRequested

    const line = await prisma.clientAuthorizationLine.create({
      data: {
        authorizationId,
        cptCode: input.cptCode,
        authRequired: input.authRequired ?? true,
        unitsRequested,
        unitsApproved,
        isUnderApproved: underApproved,
        unitsAuthorized,
        unitsUsed,
        description: input.description?.trim() || cptLabel(input.cptCode),
      },
    })

    await syncStageRequirements(auth.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: auth.serviceClientId,
      action: 'AUTH_LINE_ADD',
    })
    revalidateClient(auth.serviceClientId)
    return { ok: true, id: line.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateAuthorizationLine(
  lineId: string,
  input: {
    cptCode?: string
    authRequired?: boolean | null
    unitsRequested?: number | null
    unitsApproved?: number | null
    unitsAuthorized?: number
    unitsUsed?: number
    description?: string | null
  }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const line = await prisma.clientAuthorizationLine.findUnique({
      where: { id: lineId },
      include: { authorization: { select: { serviceClientId: true } } },
    })
    if (!line) return { ok: false, error: 'Not found', status: 404 }
    await assertCanEditClient(user, line.authorization.serviceClientId)

    if (input.cptCode !== undefined && !isValidCpt(input.cptCode)) {
      return { ok: false, error: 'Invalid CPT code' }
    }

    const nextRequested =
      input.unitsRequested !== undefined
        ? input.unitsRequested == null
          ? null
          : Math.max(0, Math.floor(input.unitsRequested))
        : line.unitsRequested
    const nextApproved =
      input.unitsApproved !== undefined
        ? input.unitsApproved == null
          ? null
          : Math.max(0, Math.floor(input.unitsApproved))
        : line.unitsApproved
    const underApproved =
      nextRequested != null && nextApproved != null && nextApproved < nextRequested

    await prisma.clientAuthorizationLine.update({
      where: { id: lineId },
      data: {
        ...(input.cptCode !== undefined ? { cptCode: input.cptCode } : {}),
        ...(input.authRequired !== undefined ? { authRequired: input.authRequired } : {}),
        ...(input.unitsRequested !== undefined ? { unitsRequested: nextRequested } : {}),
        ...(input.unitsApproved !== undefined ? { unitsApproved: nextApproved } : {}),
        isUnderApproved: underApproved,
        ...(input.unitsAuthorized !== undefined
          ? { unitsAuthorized: Math.max(0, Math.floor(input.unitsAuthorized)) }
          : {}),
        ...(input.unitsUsed !== undefined
          ? { unitsUsed: Math.max(0, Math.floor(input.unitsUsed)) }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: line.authorization.serviceClientId,
      action: 'AUTH_LINE_UPDATE',
    })
    revalidateClient(line.authorization.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteAuthorizationLine(
  lineId: string
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const line = await prisma.clientAuthorizationLine.findUnique({
      where: { id: lineId },
      include: { authorization: { select: { serviceClientId: true } } },
    })
    if (!line) return { ok: false, error: 'Not found', status: 404 }
    await assertCanEditClient(user, line.authorization.serviceClientId)

    await prisma.clientAuthorizationLine.update({
      where: { id: lineId },
      data: softDeleteData(user.id),
    })
    await syncStageRequirements(line.authorization.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: line.authorization.serviceClientId,
      action: 'AUTH_LINE_DELETE',
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'ClientAuthorizationLine',
      entityId: lineId,
      action: 'DELETE',
      after: { softDeleted: true, serviceClientId: line.authorization.serviceClientId },
    })
    revalidateClient(line.authorization.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function assignRbt(
  clientId: string,
  input: {
    rbtProfileId: string
    isPrimary?: boolean
    assignmentStage?: AssignmentStage
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: input.rbtProfileId },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!rbt) return { ok: false, error: 'RBT not found' }

    const btName = `${rbt.firstName} ${rbt.lastName}`.trim()
    const stage = input.assignmentStage ?? 'ASSIGNED'

    if (input.isPrimary) {
      await prisma.serviceClientBtAssignment.updateMany({
        where: { serviceClientId: clientId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const row = await prisma.serviceClientBtAssignment.create({
      data: {
        serviceClientId: clientId,
        rbtProfileId: rbt.id,
        btName,
        isPrimary: input.isPrimary ?? false,
        assignmentStage: stage,
        status: 'ACTIVE',
      },
    })

    await syncStageRequirements(clientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'RBT_ASSIGN',
    })
    revalidateClient(clientId)
    return { ok: true, id: row.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateRbtAssignment(
  assignmentId: string,
  input: {
    assignmentStage?: AssignmentStage
    isPrimary?: boolean
    status?: ServiceBtAssignmentStatus
  }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const existing = await prisma.serviceClientBtAssignment.findUnique({
      where: { id: assignmentId },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }
    await assertCanEditClient(user, existing.serviceClientId)

    if (input.isPrimary) {
      await prisma.serviceClientBtAssignment.updateMany({
        where: {
          serviceClientId: existing.serviceClientId,
          isPrimary: true,
          NOT: { id: assignmentId },
        },
        data: { isPrimary: false },
      })
    }

    await prisma.serviceClientBtAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(input.assignmentStage !== undefined
          ? { assignmentStage: input.assignmentStage }
          : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    })

    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'RBT_ASSIGNMENT_UPDATE',
    })
    revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function removeRbtAssignment(
  assignmentId: string
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const existing = await prisma.serviceClientBtAssignment.findUnique({
      where: { id: assignmentId },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }
    await assertCanEditClient(user, existing.serviceClientId)

    await prisma.serviceClientBtAssignment.update({
      where: { id: assignmentId },
      data: { ...softDeleteData(user.id), status: 'ENDED' },
    })
    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'RBT_ASSIGNMENT_REMOVE',
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'ServiceClientBtAssignment',
      entityId: assignmentId,
      action: 'DELETE',
      after: { softDeleted: true, serviceClientId: existing.serviceClientId },
    })
    revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function assignBcba(
  clientId: string,
  bcbaProfileId: string | null
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    let bcbaName: string | null = null
    if (bcbaProfileId) {
      const bcba = await prisma.bCBAProfile.findUnique({
        where: { id: bcbaProfileId },
        select: { id: true, fullName: true },
      })
      if (!bcba) return { ok: false, error: 'BCBA not found' }
      bcbaName = bcba.fullName
    }

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        bcbaProfileId,
        bcbaName,
      },
    })

    await syncStageRequirements(clientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'BCBA_ASSIGN',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function updateStaffingCoverageNeeds(
  clientId: string,
  input: { needsMoreHours: boolean; highPriority?: boolean }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUnique({
      where: { id: clientId },
      select: { stage: true },
    })
    if (!client) return { ok: false, error: 'Not found', status: 404 }
    if (client.stage !== 'ACTIVE') {
      return {
        ok: false,
        error: 'Only active clients can be flagged for staffing coverage',
      }
    }

    const needsMoreHours = input.needsMoreHours
    const highPriority = needsMoreHours ? (input.highPriority ?? false) : false

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: {
        staffingNeedsMoreHours: needsMoreHours,
        staffingHighPriority: highPriority,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: needsMoreHours
        ? highPriority
          ? 'STAFFING_NEEDS_HOURS_HIGH_PRIORITY'
          : 'STAFFING_NEEDS_HOURS'
        : 'STAFFING_NEEDS_HOURS_CLEARED',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function flagRbtReplacement(
  clientId: string,
  input: {
    btName: string
    reason?: string
    coverageNotes?: string
    expectedReturnDate?: string | null
  }
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const client = await prisma.serviceClient.findUnique({
      where: { id: clientId },
      select: { stage: true, pipelineStatus: true },
    })
    if (!client) return { ok: false, error: 'Not found', status: 404 }

    const now = new Date()
    const expected =
      parseDate(input.expectedReturnDate) ??
      new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.clientRbtBreak.create({
        data: {
          serviceClientId: clientId,
          btName: input.btName.trim(),
          reason: 'OTHER',
          startDate: now,
          expectedReturnDate: expected,
          status: 'ON_BREAK',
          coverageNotes:
            input.coverageNotes?.trim() ||
            input.reason?.trim() ||
            'RBT replacement needed',
          hasCoverage: false,
          createdBy: user.id,
        },
      }),
      prisma.clientAlert.create({
        data: {
          serviceClientId: clientId,
          alertType: 'RBT_REPLACEMENT_NEEDED',
          severity: 'WARNING',
          message:
            input.reason?.trim() ||
            `RBT replacement needed for ${input.btName.trim()}`,
          dueAt: expected,
        },
      }),
    ])

    // Intentionally do NOT change stage or pipelineStatus
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'RBT_REPLACEMENT_FLAG',
    })
    revalidateClient(clientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function addScheduleEntry(
  clientId: string,
  input: {
    rbtProfileId: string
    dayOfWeek: number
    startTime: string
    endTime: string
    location?: string | null
    notes?: string | null
  }
): Promise<ActionResult<{ id: string; warning?: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      return { ok: false, error: 'Invalid day of week' }
    }

    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: input.rbtProfileId },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!rbt) return { ok: false, error: 'RBT not found' }

    const assigned = await prisma.serviceClientBtAssignment.findFirst({
      where: {
        serviceClientId: clientId,
        rbtProfileId: input.rbtProfileId,
        status: 'ACTIVE',
      },
    })
    // Soft validation — warn via error only if there are active assignments and this RBT isn't among them
    const anyAssigned = await prisma.serviceClientBtAssignment.count({
      where: { serviceClientId: clientId, status: 'ACTIVE', rbtProfileId: { not: null } },
    })
    if (anyAssigned > 0 && !assigned) {
      return {
        ok: false,
        error: 'Schedule RBT should be one of the assigned care-team RBTs',
      }
    }

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      select: { firstName: true, lastName: true, borough: true, authHours: true },
    })
    const period = await getClientSchedulePeriod()
    const treatmentAuths = await prisma.clientAuthorization.findMany({
      where: {
        serviceClientId: clientId,
        deletedAt: null,
        authType: 'TREATMENT',
        status: 'APPROVED',
      },
      select: {
        effectiveDate: true,
        expirationDate: true,
        renderingProviderId: true,
        serviceLocation: true,
        lines: {
          where: { deletedAt: null },
          select: { cptCode: true, authRequired: true },
        },
      },
    })
    const cptCode = '97153'
    const billability = computeSessionBillability({
      dateOfService: period.startDate,
      cptCode,
      serviceLocation: input.location ?? null,
      authorizations: treatmentAuths,
    })

    const existingHours = await prisma.rbtScheduleAssignment.findMany({
      where: {
        serviceClientId: clientId,
        isActive: true,
        deletedAt: null,
        reviewStatus: { in: ['NONE', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true },
    })
    const currentHours = existingHours.reduce(
      (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
      0
    )
    const addedHours = hoursBetween(input.startTime, input.endTime)
    const hoursCheck = authorizedHoursWarning({
      currentHours,
      addedHours,
      authHours: client.authHours,
    })

    const row = await prisma.rbtScheduleAssignment.create({
      data: {
        rbtProfileId: rbt.id,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || '[CRM] schedule entry',
        isActive: true,
        source: 'MANUAL',
        clientBorough: client.borough,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        serviceClientId: clientId,
        cptCode,
        serviceLocation: input.location?.trim() || null,
        billabilityStatus: billability.status,
        billabilityReason: billability.reason,
        serviceClientLinkManual: true,
        createdBy: user.id,
      },
    })

    await syncStageRequirements(clientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'SCHEDULE_ADD',
    })
    revalidateClient(clientId)
    revalidatePath(CRM_SCHEDULE_PATH)
    return { ok: true, id: row.id, warning: hoursCheck.warning }
  } catch (err) {
    return fail(err)
  }
}

export async function addScheduleEntries(
  clientId: string,
  input: {
    rbtProfileId: string
    startTime: string
    endTime: string
    location?: string | null
    notes?: string | null
    days: { dayOfWeek: number; startTime?: string; endTime?: string }[]
  }
): Promise<
  ActionResult<{
    ids: string[]
    warning?: string
    projectedHours: number
    authHours: number | null
  }>
> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)
    if (!input.days.length) return { ok: false, error: 'Select at least one day' }

    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: input.rbtProfileId },
      select: { id: true },
    })
    if (!rbt) return { ok: false, error: 'RBT not found' }

    const assigned = await prisma.serviceClientBtAssignment.findFirst({
      where: {
        serviceClientId: clientId,
        rbtProfileId: input.rbtProfileId,
        status: 'ACTIVE',
      },
    })
    const anyAssigned = await prisma.serviceClientBtAssignment.count({
      where: { serviceClientId: clientId, status: 'ACTIVE', rbtProfileId: { not: null } },
    })
    if (anyAssigned > 0 && !assigned) {
      return {
        ok: false,
        error: 'Schedule RBT should be one of the assigned care-team RBTs',
      }
    }

    for (const d of input.days) {
      if (d.dayOfWeek < 0 || d.dayOfWeek > 6) {
        return { ok: false, error: 'Invalid day of week' }
      }
    }

    const client = await prisma.serviceClient.findUniqueOrThrow({
      where: { id: clientId },
      select: { firstName: true, lastName: true, borough: true, authHours: true },
    })
    const period = await getClientSchedulePeriod()
    const treatmentAuths = await prisma.clientAuthorization.findMany({
      where: {
        serviceClientId: clientId,
        deletedAt: null,
        authType: 'TREATMENT',
        status: 'APPROVED',
      },
      select: {
        effectiveDate: true,
        expirationDate: true,
        renderingProviderId: true,
        serviceLocation: true,
        lines: {
          where: { deletedAt: null },
          select: { cptCode: true, authRequired: true },
        },
      },
    })
    const cptCode = '97153'
    const billability = computeSessionBillability({
      dateOfService: period.startDate,
      cptCode,
      serviceLocation: input.location ?? null,
      authorizations: treatmentAuths,
    })
    const existingHours = await prisma.rbtScheduleAssignment.findMany({
      where: {
        serviceClientId: clientId,
        isActive: true,
        deletedAt: null,
        reviewStatus: { in: ['NONE', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true },
    })
    const currentHours = existingHours.reduce(
      (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
      0
    )
    const addedHours = input.days.reduce((sum, d) => {
      const start = d.startTime ?? input.startTime
      const end = d.endTime ?? input.endTime
      return sum + hoursBetween(start, end)
    }, 0)
    const hoursCheck = authorizedHoursWarning({
      currentHours,
      addedHours,
      authHours: client.authHours,
    })

    const ids: string[] = []
    for (const d of input.days) {
      const startTime = d.startTime ?? input.startTime
      const endTime = d.endTime ?? input.endTime
      if (hoursBetween(startTime, endTime) <= 0) {
        return { ok: false, error: 'End time must be after start time' }
      }
      const row = await prisma.rbtScheduleAssignment.create({
        data: {
          rbtProfileId: rbt.id,
          clientName: `${client.firstName} ${client.lastName}`.trim(),
          dayOfWeek: d.dayOfWeek,
          startTime,
          endTime,
          location: input.location?.trim() || null,
          notes: input.notes?.trim() || '[CRM] schedule entry',
          isActive: true,
          source: 'MANUAL',
          reviewStatus: 'NONE',
          clientBorough: client.borough,
          periodStart: period.startDate,
          periodEnd: period.endDate,
          serviceClientId: clientId,
          cptCode,
          serviceLocation: input.location?.trim() || null,
          billabilityStatus: billability.status,
          billabilityReason: billability.reason,
          serviceClientLinkManual: true,
          createdBy: user.id,
        },
      })
      ids.push(row.id)
    }

    await syncStageRequirements(clientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'SCHEDULE_ADD',
    })
    revalidateClient(clientId)
    revalidatePath(CRM_SCHEDULE_PATH)
    return {
      ok: true,
      ids,
      warning: hoursCheck.warning,
      projectedHours: hoursCheck.projectedHours,
      authHours: client.authHours,
    }
  } catch (err) {
    return fail(err) as ActionResult<{
      ids: string[]
      warning?: string
      projectedHours: number
      authHours: number | null
    }>
  }
}

export async function updateScheduleEntry(
  entryId: string,
  input: {
    rbtProfileId?: string
    dayOfWeek?: number
    startTime?: string
    endTime?: string
    location?: string | null
    notes?: string | null
  }
): Promise<ActionResult> {
  try {
    const parsedInput = ScheduleEntryUpdateSchema.parse(input)
    const user = await getClientServicesUser()
    const existing = await prisma.rbtScheduleAssignment.findUnique({
      where: { id: entryId },
    })
    if (!existing?.serviceClientId) {
      return { ok: false, error: 'Not found', status: 404 }
    }
    await assertCanEditClient(user, existing.serviceClientId)

    await prisma.rbtScheduleAssignment.update({
      where: { id: entryId },
      data: {
        ...(parsedInput.rbtProfileId !== undefined
          ? { rbtProfileId: parsedInput.rbtProfileId }
          : {}),
        ...(parsedInput.dayOfWeek !== undefined ? { dayOfWeek: parsedInput.dayOfWeek } : {}),
        ...(parsedInput.startTime !== undefined ? { startTime: parsedInput.startTime } : {}),
        ...(parsedInput.endTime !== undefined ? { endTime: parsedInput.endTime } : {}),
        ...(parsedInput.location !== undefined
          ? { location: parsedInput.location?.trim() || null }
          : {}),
        ...(parsedInput.notes !== undefined
          ? { notes: parsedInput.notes?.trim() || null }
          : {}),
      },
    })

    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'SCHEDULE_UPDATE',
    })
    revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function removeScheduleEntry(entryId: string): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    const existing = await prisma.rbtScheduleAssignment.findUnique({
      where: { id: entryId },
    })
    if (!existing?.serviceClientId) {
      return { ok: false, error: 'Not found', status: 404 }
    }
    await assertCanEditClient(user, existing.serviceClientId)

    await prisma.rbtScheduleAssignment.update({
      where: { id: entryId },
      data: { isActive: false, ...softDeleteData(user.id) },
    })

    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'SCHEDULE_REMOVE',
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'RbtScheduleAssignment',
      entityId: entryId,
      action: 'DELETE',
      after: {
        softDeleted: true,
        serviceClientId: existing.serviceClientId,
        clientName: existing.clientName,
      },
    })
    revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function logCommunication(
  clientId: string,
  input: {
    template: CommTemplate
    channel: CommChannel
    direction: CommDirection
    subject?: string | null
    body?: string | null
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)

    const now = new Date()
    const row = await prisma.clientCommunication.create({
      data: {
        serviceClientId: clientId,
        template: input.template,
        channel: input.channel,
        direction: input.direction,
        subject: input.subject?.trim() || null,
        body: input.body?.trim() || null,
        sentByUserId: user.id,
        sentAt: now,
        status: 'RECORDED',
      },
    })

    if (input.direction === 'OUTBOUND') {
      await prisma.serviceClient.update({
        where: { id: clientId },
        data: { lastParentContactAt: now },
      })
    }

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'COMM_LOG',
    })
    revalidateClient(clientId)
    return { ok: true, id: row.id }
  } catch (err) {
    return fail(err)
  }
}

export async function previewClientEmail(
  clientId: string,
  input: {
    template: CommTemplate
    subject?: string | null
    bodyHtml?: string | null
  }
): Promise<ActionResult<{ subject: string; html: string; to: string | null }>> {
  try {
    const user = await getClientServicesUser()
    const { previewStaffClientEmail } = await import('@/lib/crm/emails/staffSend')
    const preview = await previewStaffClientEmail(user, clientId, input)
    return {
      ok: true,
      subject: preview.subject,
      html: preview.html,
      to: preview.to,
    }
  } catch (err) {
    return fail(err)
  }
}

export async function sendClientEmail(
  clientId: string,
  input: {
    template: CommTemplate
    subject?: string | null
    bodyHtml?: string | null
    cc?: string | null
    force?: boolean
  }
): Promise<
  ActionResult<{ status: string; communicationId: string; reason?: string }>
> {
  try {
    const user = await getClientServicesUser()
    const { sendStaffClientEmail } = await import('@/lib/crm/emails/staffSend')
    const result = await sendStaffClientEmail(user, clientId, input)
    revalidateClient(clientId)
    return {
      ok: true,
      status: result.status,
      communicationId: result.communicationId,
      reason: result.reason,
    }
  } catch (err) {
    return fail(err)
  }
}

/** Full-access override: resend a journey template even if SENT/SKIPPED exists. */
export async function resendJourneyEmail(
  clientId: string,
  template: CommTemplate
): Promise<ActionResult<{ status: string; communicationId?: string }>> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to resend journey emails', 403)
    }
    await assertCanEditClient(user, clientId)

    const { sendJourneyTemplate } = await import('@/lib/crm/emails/send')
    const result = await sendJourneyTemplate(clientId, template, {
      actorUserId: user.id,
      force: true,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `JOURNEY_EMAIL_RESEND:${template}`,
    })
    revalidateClient(clientId)
    return {
      ok: true,
      status: result.status,
      communicationId: result.communicationId,
    }
  } catch (err) {
    return fail(err)
  }
}

/** Soft-delete a family record. Full-access only. Never hard-deletes. */
export async function softDeleteServiceClient(
  clientId: string
): Promise<ActionResult<{ clientCode: string; name: string }>> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to delete a family record', 403)
    }
    await assertCanEditClient(user, clientId)

    const existing = await prisma.serviceClient.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true, clientCode: true, firstName: true, lastName: true },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }

    const name = `${existing.firstName} ${existing.lastName}`.trim()
    await prisma.serviceClient.update({
      where: { id: clientId },
      data: softDeleteData(user.id),
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'CLIENT_SOFT_DELETE',
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'ServiceClient',
      entityId: clientId,
      action: 'DELETE',
      after: { softDeleted: true, clientCode: existing.clientCode, name },
    })

    revalidatePath('/client-services')
    revalidatePath('/client-services/admin')
    return { ok: true, clientCode: existing.clientCode, name }
  } catch (err) {
    return fail(err) as ActionResult<{ clientCode: string; name: string }>
  }
}

/** Restore a soft-deleted family record. Full-access only. */
export async function restoreServiceClient(
  clientId: string
): Promise<ActionResult<{ clientCode: string; name: string }>> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to restore a family record', 403)
    }

    const existing = await prisma.serviceClient.findFirst({
      where: { id: clientId, deletedAt: { not: null } },
      select: {
        id: true,
        clientCode: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
      },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }

    const name = `${existing.firstName} ${existing.lastName}`.trim()
    await prisma.serviceClient.update({
      where: { id: clientId },
      data: restoreData(),
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'CLIENT_RESTORE',
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'ServiceClient',
      entityId: clientId,
      action: 'UPDATE',
      before: { deletedAt: existing.deletedAt?.toISOString() },
      after: { restored: true, clientCode: existing.clientCode, name },
    })

    revalidateClient(clientId)
    revalidatePath('/client-services/admin')
    return { ok: true, clientCode: existing.clientCode, name }
  } catch (err) {
    return fail(err) as ActionResult<{ clientCode: string; name: string }>
  }
}

export async function listDeletedServiceClients(): Promise<
  ActionResult<{
    clients: {
      id: string
      clientCode: string
      firstName: string
      lastName: string
      deletedAt: string
      deletedByUserId: string | null
    }[]
  }>
> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to list deleted family records', 403)
    }

    const rows = await prisma.serviceClient.findMany({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        clientCode: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        deletedByUserId: true,
      },
      orderBy: { deletedAt: 'desc' },
      take: 100,
    })

    return {
      ok: true,
      clients: rows.map((r) => ({
        id: r.id,
        clientCode: r.clientCode,
        firstName: r.firstName,
        lastName: r.lastName,
        deletedAt: r.deletedAt!.toISOString(),
        deletedByUserId: r.deletedByUserId,
      })),
    }
  } catch (err) {
    return fail(err) as ActionResult<{ clients: never[] }>
  }
}

export async function listBoardMigrationReview(): Promise<
  ActionResult<{
    rows: {
      id: string
      clientName: string
      dayOfWeek: number
      startTime: string
      endTime: string
      location: string | null
      rbtName: string
      rbtProfileId: string
      serviceClientId: string | null
      serviceClientLive: boolean | null
      conflict: boolean
      createdAt: string
    }[]
  }>
> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required to review migrated board slots', 403)
    }

    const pending = await prisma.rbtScheduleAssignment.findMany({
      where: {
        source: 'BOARD_MIGRATION',
        reviewStatus: 'PENDING',
        deletedAt: null,
      },
      include: {
        rbtProfile: { select: { firstName: true, lastName: true } },
        serviceClient: { select: { pipelineStatus: true, deletedAt: true } },
      },
      orderBy: [{ clientName: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    const liveForClients =
      pending.length === 0
        ? []
        : await prisma.rbtScheduleAssignment.findMany({
            where: {
              isActive: true,
              deletedAt: null,
              reviewStatus: { in: ['NONE', 'CONFIRMED'] },
              OR: pending.flatMap((p) => {
                const ors: (
                  | { serviceClientId: string }
                  | { clientName: string }
                )[] = [{ clientName: p.clientName }]
                if (p.serviceClientId) {
                  ors.push({ serviceClientId: p.serviceClientId })
                }
                return ors
              }),
            },
            select: {
              id: true,
              rbtProfileId: true,
              serviceClientId: true,
              clientName: true,
            },
          })

    return {
      ok: true,
      rows: pending.map((p) => {
        const conflict = liveForClients.some(
          (a) =>
            a.rbtProfileId !== p.rbtProfileId &&
            (a.serviceClientId
              ? a.serviceClientId === p.serviceClientId
              : a.clientName === p.clientName)
        )
        return {
          id: p.id,
          clientName: p.clientName,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          location: p.location,
          rbtName: `${p.rbtProfile.firstName} ${p.rbtProfile.lastName}`.trim(),
          rbtProfileId: p.rbtProfileId,
          serviceClientId: p.serviceClientId,
          serviceClientLive:
            p.serviceClient && !p.serviceClient.deletedAt
              ? p.serviceClient.pipelineStatus === 'LIVE'
              : null,
          conflict,
          createdAt: p.createdAt.toISOString(),
        }
      }),
    }
  } catch (err) {
    return fail(err) as ActionResult<{ rows: never[] }>
  }
}

export async function confirmBoardMigrationRow(
  id: string
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required', 403)
    }
    const existing = await prisma.rbtScheduleAssignment.findFirst({
      where: { id, reviewStatus: 'PENDING', deletedAt: null },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }

    await prisma.rbtScheduleAssignment.update({
      where: { id },
      data: { isActive: true, reviewStatus: 'CONFIRMED' },
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'RbtScheduleAssignment',
      entityId: id,
      action: 'UPDATE',
      after: { reviewStatus: 'CONFIRMED', isActive: true },
    })
    revalidatePath(CRM_SCHEDULE_PATH)
    revalidatePath('/client-services/admin')
    if (existing.serviceClientId) revalidateClient(existing.serviceClientId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function discardBoardMigrationRow(
  id: string
): Promise<ActionResult> {
  try {
    const user = await getClientServicesUser()
    if (!isFullAccess(user)) {
      throw new CrmAccessError('Full access required', 403)
    }
    const existing = await prisma.rbtScheduleAssignment.findFirst({
      where: { id, reviewStatus: 'PENDING', deletedAt: null },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }

    await prisma.rbtScheduleAssignment.update({
      where: { id },
      data: {
        isActive: false,
        reviewStatus: 'DISCARDED',
        ...softDeleteData(user.id),
      },
    })
    await writeAuditLog({
      actorUserId: user.id,
      entityType: 'RbtScheduleAssignment',
      entityId: id,
      action: 'DELETE',
      after: { reviewStatus: 'DISCARDED', softDeleted: true },
    })
    revalidatePath('/client-services/admin')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
