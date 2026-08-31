import 'server-only'

import { prisma } from '@/lib/prisma'
import { formatClientAddress } from '@/lib/crm/emails/templates/helpers'
import type { StaffMergeFields } from '@/lib/crm/emails/templates/types'
import { CASE_COORDINATION_NOT_ASSIGNED } from '@/lib/crm/caseCoordination/boilerplate'
import {
  parseCaseCoordinationOverrides,
  type CaseCoordinationBtRow,
  type CaseCoordinationOverrides,
} from '@/lib/crm/caseCoordination/schema'
import { formatScheduleForBt } from '@/lib/crm/caseCoordination/scheduleString'
import { formatEmailDate } from '@/lib/crm/emails/mergeContext'

export type CaseCoordinationDocumentPayload = {
  clientName: string
  serviceAddress: string
  parentGuardianName: string
  parentEmail: string
  parentContactNumber: string
  bcbaName: string
  bcbaContactNumber: string
  bcbaEmail: string
  behaviorTechnicians: CaseCoordinationBtRow[]
  coordinatorName: string
  coordinatorContactNumber: string
  coordinatorEmail: string
}

export type CaseCoordinationSnapshot = CaseCoordinationDocumentPayload & {
  snapshottedAt: string
}

function display(value: string | null | undefined, fallback = CASE_COORDINATION_NOT_ASSIGNED) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function formatPhoneEmail(phone: string | null | undefined, email: string | null | undefined) {
  const parts = [phone?.trim(), email?.trim()].filter(Boolean)
  return parts.length ? parts.join(' · ') : CASE_COORDINATION_NOT_ASSIGNED
}

function formatStartDate(d: Date | null | undefined): string {
  if (!d) return CASE_COORDINATION_NOT_ASSIGNED
  return formatEmailDate(d) ?? CASE_COORDINATION_NOT_ASSIGNED
}

async function loadClientForCaseCoordination(serviceClientId: string) {
  return prisma.serviceClient.findFirst({
    where: { id: serviceClientId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentEmail: true,
      parentPhone: true,
      addressLine: true,
      city: true,
      state: true,
      zip: true,
      bcbaName: true,
      caseCoordinatorName: true,
      actualServiceStartDate: true,
      serviceStartDate: true,
      caseCoordinatorUser: {
        select: { name: true, email: true, phoneNumber: true },
      },
      bcbaProfile: { select: { fullName: true, email: true, phone: true } },
      scheduleAssignments: {
        where: {
          isActive: true,
          deletedAt: null,
          reviewStatus: { in: ['NONE', 'CONFIRMED'] },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          rbtProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
      btAssignments: {
        where: { status: 'ACTIVE', deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        include: {
          rbtProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  })
}

function buildBehaviorTechnicianRows(
  client: NonNullable<Awaited<ReturnType<typeof loadClientForCaseCoordination>>>
): CaseCoordinationBtRow[] {
  const byRbt = new Map<string, CaseCoordinationBtRow>()

  for (const assignment of client.scheduleAssignments) {
    const profile = assignment.rbtProfile
    const rbtProfileId = profile?.id ?? assignment.rbtProfileId
    const name = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : 'Behavior Technician'

    const slots = client.scheduleAssignments
      .filter((a) => a.rbtProfileId === rbtProfileId)
      .map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      }))

    const startCandidates = client.scheduleAssignments
      .filter((a) => a.rbtProfileId === rbtProfileId)
      .map((a) => a.periodStart ?? a.createdAt)
      .filter(Boolean) as Date[]
    const earliestStart =
      startCandidates.length > 0
        ? new Date(Math.min(...startCandidates.map((d) => d.getTime())))
        : client.actualServiceStartDate ?? client.serviceStartDate

    const row: CaseCoordinationBtRow = {
      id: rbtProfileId,
      rbtProfileId,
      behaviorTechnician: name,
      phoneEmail: profile
        ? formatPhoneEmail(profile.phoneNumber, profile.email)
        : CASE_COORDINATION_NOT_ASSIGNED,
      schedule: formatScheduleForBt(slots) || CASE_COORDINATION_NOT_ASSIGNED,
      startDate: formatStartDate(earliestStart),
      manual: false,
    }

    if (!byRbt.has(rbtProfileId)) {
      byRbt.set(rbtProfileId, row)
    }
  }

  for (const assignment of client.btAssignments) {
    const profile = assignment.rbtProfile
    const rbtProfileId = profile?.id
    if (rbtProfileId && byRbt.has(rbtProfileId)) continue

    const name =
      (profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : assignment.btName?.trim()) || 'Behavior Technician'

    const key = rbtProfileId ?? `assignment:${assignment.id}`
    if (byRbt.has(key)) continue

    byRbt.set(key, {
      id: key,
      rbtProfileId: rbtProfileId ?? null,
      behaviorTechnician: name,
      phoneEmail: profile
        ? formatPhoneEmail(profile.phoneNumber, profile.email)
        : CASE_COORDINATION_NOT_ASSIGNED,
      schedule: CASE_COORDINATION_NOT_ASSIGNED,
      startDate: formatStartDate(
        client.actualServiceStartDate ?? client.serviceStartDate
      ),
      manual: false,
    })
  }

  return [...byRbt.values()]
}

function basePayloadFromClient(
  client: NonNullable<Awaited<ReturnType<typeof loadClientForCaseCoordination>>>
): CaseCoordinationDocumentPayload {
  const mergeAddress = formatClientAddress({
    childFirstName: client.firstName,
    childLastName: client.lastName,
    clientAddressLine: client.addressLine,
    clientCity: client.city,
    clientState: client.state,
    clientZip: client.zip,
  } as StaffMergeFields)

  const bcba = client.bcbaProfile
  const coordinator = client.caseCoordinatorUser

  return {
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    serviceAddress: mergeAddress ?? CASE_COORDINATION_NOT_ASSIGNED,
    parentGuardianName: display(client.parentName),
    parentEmail: display(client.parentEmail),
    parentContactNumber: display(client.parentPhone),
    bcbaName: display(bcba?.fullName ?? client.bcbaName),
    bcbaContactNumber: display(bcba?.phone),
    bcbaEmail: display(bcba?.email),
    behaviorTechnicians: buildBehaviorTechnicianRows(client),
    coordinatorName: display(coordinator?.name ?? client.caseCoordinatorName),
    coordinatorContactNumber: display(coordinator?.phoneNumber),
    coordinatorEmail: display(coordinator?.email),
  }
}

function applyFieldOverrides(
  payload: CaseCoordinationDocumentPayload,
  overrides: CaseCoordinationOverrides | null | undefined
): CaseCoordinationDocumentPayload {
  const fields = overrides?.fields
  const withFields = fields
    ? {
        ...payload,
        clientName: fields.clientName?.trim() || payload.clientName,
        serviceAddress: fields.serviceAddress?.trim() || payload.serviceAddress,
        parentGuardianName:
          fields.parentGuardianName?.trim() || payload.parentGuardianName,
        parentEmail: fields.parentEmail?.trim() || payload.parentEmail,
        parentContactNumber:
          fields.parentContactNumber?.trim() || payload.parentContactNumber,
        bcbaName: fields.bcbaName?.trim() || payload.bcbaName,
        bcbaContactNumber:
          fields.bcbaContactNumber?.trim() || payload.bcbaContactNumber,
        bcbaEmail: fields.bcbaEmail?.trim() || payload.bcbaEmail,
        coordinatorName: fields.coordinatorName?.trim() || payload.coordinatorName,
        coordinatorContactNumber:
          fields.coordinatorContactNumber?.trim() || payload.coordinatorContactNumber,
        coordinatorEmail: fields.coordinatorEmail?.trim() || payload.coordinatorEmail,
      }
    : payload

  return {
    ...withFields,
    behaviorTechnicians:
      overrides?.behaviorTechnicians?.length
        ? overrides.behaviorTechnicians
        : withFields.behaviorTechnicians,
  }
}

export async function resolveCaseCoordinationDocument(
  serviceClientId: string,
  overrides?: CaseCoordinationOverrides | null
): Promise<CaseCoordinationDocumentPayload | null> {
  const client = await loadClientForCaseCoordination(serviceClientId)
  if (!client) return null
  const base = basePayloadFromClient(client)
  return applyFieldOverrides(base, overrides)
}

export function applyCaseCoordinationOverrides(
  payload: CaseCoordinationDocumentPayload,
  rawOverrides: unknown
): CaseCoordinationDocumentPayload {
  return applyFieldOverrides(payload, parseCaseCoordinationOverrides(rawOverrides))
}

export function snapshotCaseCoordinationPayload(
  payload: CaseCoordinationDocumentPayload
): CaseCoordinationSnapshot {
  return {
    ...payload,
    behaviorTechnicians: payload.behaviorTechnicians.map((row) => ({ ...row })),
    snapshottedAt: new Date().toISOString(),
  }
}

export function readConfirmedSnapshot(
  overrides: unknown
): CaseCoordinationSnapshot | null {
  const raw = overrides as { snapshot?: CaseCoordinationSnapshot } | null
  const snapshot = raw?.snapshot
  if (!snapshot?.clientName) return null
  return snapshot
}
