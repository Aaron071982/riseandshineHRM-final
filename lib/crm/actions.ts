'use server'

import type {
  AssignmentStage,
  AuthStatus,
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
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  assertCanEditClient,
  auditClientAction,
  CrmAccessError,
  getClientServicesUser,
  isFullAccess,
} from '@/lib/crm/access'
import {
  canAdvance,
  canSetRbtTargetDate,
  nextStage,
  REQUIREMENT_KEY_LABELS,
  STAGE_DEFAULT_OWNER_DEPT,
  STAGE_GATE_REQUIREMENT_KEYS,
  STANDARD_DOCUMENT_REQUIREMENT_KEYS,
} from '@/lib/crm/stages'
import { isValidCpt, cptLabel } from '@/lib/crm/cpt'
import { syncStageRequirements } from '@/lib/crm/syncStageRequirements'
import { getClientSchedulePeriod } from '@/lib/client-services/schedulePeriod'

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
  if (err instanceof CrmAccessError) {
    return { ok: false, error: err.message, status: err.status }
  }
  console.error('[crm] action failed', err)
  return { ok: false, error: 'Something went wrong' }
}

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
      include: { requirements: true },
    })

    const gate = canAdvance(
      {
        stage: client.stage,
        treatmentPlanStatus: client.treatmentPlanStatus,
      },
      client.requirements
    )
    if (!gate.ok) {
      return {
        ok: false,
        error: 'Requirements incomplete',
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
        await tx.clientRequirement.create({
          data: {
            serviceClientId: clientId,
            stage: toStage,
            key,
            label: REQUIREMENT_KEY_LABELS[key] ?? key,
            type: 'TASK',
            status: 'PENDING',
            isRequiredToAdvance: true,
          },
        })
      }

      await tx.serviceClient.update({
        where: { id: clientId },
        data: {
          stage: toStage,
          stageEnteredAt: now,
          currentOwnerDept: STAGE_DEFAULT_OWNER_DEPT[toStage],
          ...(toStage === 'ACTIVE'
            ? {
                actualServiceStartDate: client.actualServiceStartDate ?? now,
                status: 'ACTIVE',
              }
            : {}),
        },
      })
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

    const now = new Date()
    const durationSeconds = client.stageEnteredAt
      ? Math.max(0, Math.floor((now.getTime() - client.stageEnteredAt.getTime()) / 1000))
      : null

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
          currentOwnerDept: STAGE_DEFAULT_OWNER_DEPT[toStage],
          ...(toStage === 'ACTIVE'
            ? {
                actualServiceStartDate: client.actualServiceStartDate ?? now,
                status: client.pipelineStatus === 'LIVE' ? 'ACTIVE' : client.status,
              }
            : {}),
        },
      })
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

      for (const key of STANDARD_DOCUMENT_REQUIREMENT_KEYS) {
        await tx.clientRequirement.create({
          data: {
            serviceClientId: created.id,
            stage: 'DOCUMENTS',
            key,
            label: REQUIREMENT_KEY_LABELS[key] ?? key,
            type: 'DOCUMENT',
            status: 'PENDING',
            isRequiredToAdvance: [
              'insurance_card',
              'medicaid_card',
              'diagnostic_eval',
              'physician_referral',
            ].includes(key),
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

const SATISFIED: ReadonlySet<RequirementStatus> = new Set([
  'COMPLETE',
  'RECEIVED',
  'NOT_APPLICABLE',
])

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
      select: { id: true, serviceClientId: true, status: true },
    })
    if (!existing) return { ok: false, error: 'Not found', status: 404 }

    await assertCanEditClient(user, existing.serviceClientId)

    const satisfied = SATISFIED.has(input.status)
    const wasSatisfied = SATISFIED.has(existing.status)

    await prisma.clientRequirement.update({
      where: { id: requirementId },
      data: {
        status: input.status,
        fileUrl: input.fileUrl === undefined ? undefined : input.fileUrl,
        expiresAt:
          input.expiresAt === undefined
            ? undefined
            : input.expiresAt
              ? new Date(input.expiresAt)
              : null,
        notes: input.notes === undefined ? undefined : input.notes,
        completedAt: satisfied ? new Date() : null,
        completedByUserId: satisfied ? user.id : null,
        ...(wasSatisfied && !satisfied
          ? { completedAt: null, completedByUserId: null }
          : {}),
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
    payerName: string
    authNumber?: string | null
    status?: AuthStatus
    effectiveDate?: string | null
    expirationDate?: string | null
    renderingProvider?: string | null
    notes?: string | null
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getClientServicesUser()
    await assertCanEditClient(user, clientId)
    const payerName = input.payerName.trim()
    if (!payerName) return { ok: false, error: 'Payer name is required' }

    const status = input.status ?? 'REQUESTED'
    const auth = await prisma.clientAuthorization.create({
      data: {
        serviceClientId: clientId,
        authType: input.authType,
        payerName,
        authNumber: input.authNumber?.trim() || null,
        status,
        requestedAt: new Date(),
        approvedAt: status === 'APPROVED' ? new Date() : null,
        effectiveDate: parseDate(input.effectiveDate),
        expirationDate: parseDate(input.expirationDate),
        renderingProvider: input.renderingProvider?.trim() || null,
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
    payerName?: string
    authNumber?: string | null
    status?: AuthStatus
    effectiveDate?: string | null
    expirationDate?: string | null
    renderingProvider?: string | null
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
        ...(input.payerName !== undefined
          ? { payerName: input.payerName.trim() }
          : {}),
        ...(input.authNumber !== undefined
          ? { authNumber: input.authNumber?.trim() || null }
          : {}),
        ...(status !== undefined ? { status } : {}),
        ...(becomingApproved ? { approvedAt: new Date() } : {}),
        ...(input.effectiveDate !== undefined
          ? { effectiveDate: parseDate(input.effectiveDate) }
          : {}),
        ...(input.expirationDate !== undefined
          ? { expirationDate: parseDate(input.expirationDate) }
          : {}),
        ...(input.renderingProvider !== undefined
          ? { renderingProvider: input.renderingProvider?.trim() || null }
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
    const unitsUsed = Math.max(0, Math.floor(input.unitsUsed ?? 0))

    const line = await prisma.clientAuthorizationLine.create({
      data: {
        authorizationId,
        cptCode: input.cptCode,
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

    await prisma.clientAuthorizationLine.update({
      where: { id: lineId },
      data: {
        ...(input.cptCode !== undefined ? { cptCode: input.cptCode } : {}),
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

    await prisma.clientAuthorizationLine.delete({ where: { id: lineId } })
    await syncStageRequirements(line.authorization.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: line.authorization.serviceClientId,
      action: 'AUTH_LINE_DELETE',
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

    await prisma.serviceClientBtAssignment.delete({ where: { id: assignmentId } })
    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'RBT_ASSIGNMENT_REMOVE',
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
): Promise<ActionResult<{ id: string }>> {
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
      select: { firstName: true, lastName: true, borough: true },
    })
    const period = await getClientSchedulePeriod()

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
    return { ok: true, id: row.id }
  } catch (err) {
    return fail(err)
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
    const user = await getClientServicesUser()
    const existing = await prisma.rbtScheduleAssignment.findUnique({
      where: { id: entryId },
    })
    if (!existing?.serviceClientId) {
      return { ok: false, error: 'Not found', status: 404 }
    }
    await assertCanEditClient(user, existing.serviceClientId)

    if (input.dayOfWeek !== undefined && (input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
      return { ok: false, error: 'Invalid day of week' }
    }

    await prisma.rbtScheduleAssignment.update({
      where: { id: entryId },
      data: {
        ...(input.rbtProfileId !== undefined
          ? { rbtProfileId: input.rbtProfileId }
          : {}),
        ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
        ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
        ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
        ...(input.location !== undefined
          ? { location: input.location?.trim() || null }
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
      data: { isActive: false },
    })

    await syncStageRequirements(existing.serviceClientId, user.id)
    await auditClientAction({
      userId: user.id,
      serviceClientId: existing.serviceClientId,
      action: 'SCHEDULE_REMOVE',
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
