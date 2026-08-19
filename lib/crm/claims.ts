import type { ClientOwnerDept, ClientStage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { LINEAR_STAGE_ORDER } from '@/lib/crm/stages'

/** PHI-restricted unclaimed pool — never add DOB, insurance, parent, address. */
export const CLAIMABLE_POOL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  stage: true,
} as const satisfies Prisma.ServiceClientSelect

export type ClaimablePoolRow = {
  id: string
  firstName: string
  lastName: string
  stage: ClientStage
}

export const CLAIMABLE_POOL_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'stage',
] as const

export const CLAIMABLE_POOL_FORBIDDEN_FIELDS = [
  'dateOfBirth',
  'dob',
  'addressLine',
  'city',
  'state',
  'zip',
  'insuranceProvider',
  'insuranceId',
  'parentName',
  'parentEmail',
  'parentPhone',
  'diagnosis',
  'clientCode',
] as const

export function toClaimablePoolRow(row: ClaimablePoolRow): ClaimablePoolRow {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    stage: row.stage,
  }
}

export function claimablePoolPayloadKeys(row: Record<string, unknown>): string[] {
  return Object.keys(row).sort()
}

export function isReadyForCoordination(stage: ClientStage): boolean {
  if (stage === 'TREATMENT_PLAN') return false
  const ready = LINEAR_STAGE_ORDER.indexOf('RBT_ASSIGNED')
  const i = LINEAR_STAGE_ORDER.indexOf(stage)
  return i >= ready && ready >= 0
}

export function everClaimedWhere(userId: string): Prisma.ServiceClientWhereInput {
  return { claims: { some: { userId } } }
}

export function activeClaimWhere(userId: string): Prisma.ServiceClientWhereInput {
  return { claims: { some: { userId, releasedAt: null } } }
}

/** Exclusive department claim (not a CC assignment grant). */
export function noActiveDeptClaimWhere(): Prisma.ServiceClientWhereInput {
  return { claims: { none: { releasedAt: null, source: 'CLAIM' } } }
}

export async function grantClaim(params: {
  clientId: string
  userId: string
  source: 'CLAIM' | 'ASSIGNED'
  actorUserId: string
}) {
  const active = await prisma.clientClaim.findFirst({
    where: {
      serviceClientId: params.clientId,
      userId: params.userId,
      releasedAt: null,
      source: params.source,
    },
  })
  if (active) return active
  return prisma.clientClaim.create({
    data: {
      serviceClientId: params.clientId,
      userId: params.userId,
      source: params.source,
      claimedByUserId: params.actorUserId,
    },
  })
}

export async function releaseActiveGrants(params: {
  clientId: string
  userId?: string
  source?: 'CLAIM' | 'ASSIGNED'
  actorUserId: string
}) {
  await prisma.clientClaim.updateMany({
    where: {
      serviceClientId: params.clientId,
      releasedAt: null,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.source ? { source: params.source } : {}),
    },
    data: {
      releasedAt: new Date(),
      releasedByUserId: params.actorUserId,
    },
  })
}

/**
 * When ownership department changes, personal CLAIM grants are released
 * (history retained) so the receiving department's pool can pick them up.
 * ASSIGNED grants stay — the case coordinator remains assigned.
 */
export function ownershipPatchOnDeptChange(params: {
  fromDept: ClientOwnerDept | null
  toDept: ClientOwnerDept
  caseCoordinatorUserId: string | null
}): {
  deptChanged: boolean
  currentOwnerDept: ClientOwnerDept
  /** Set only when the owning department actually changes. */
  currentOwnerUserId?: string | null
  shouldReleaseClaimGrants: boolean
} {
  if (params.fromDept === params.toDept) {
    return {
      deptChanged: false,
      currentOwnerDept: params.toDept,
      shouldReleaseClaimGrants: false,
    }
  }
  const currentOwnerUserId =
    params.toDept === 'CASE_COORDINATION' && params.caseCoordinatorUserId
      ? params.caseCoordinatorUserId
      : null
  return {
    deptChanged: true,
    currentOwnerDept: params.toDept,
    currentOwnerUserId,
    shouldReleaseClaimGrants: true,
  }
}
