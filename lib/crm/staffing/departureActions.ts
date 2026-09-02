'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ActionResult } from '@/lib/crm/actions'
import {
  assertCanEditClient,
  assertCanViewClient,
  getClientServicesUser,
} from '@/lib/crm/access'
import { assertCanFlagStaffingDeparture } from '@/lib/crm/staffing/access'
import {
  clearClientRbtReplacement,
  clearRbtStaffDeparting,
  flagClientRbtReplacement,
  flagRbtStaffDeparting,
  parseExpectedEndDate,
} from '@/lib/crm/staffing/departureService'

function fail(err: unknown): ActionResult<never> {
  if (err instanceof Error) return { ok: false, error: err.message, status: 500 }
  return { ok: false, error: 'Something went wrong', status: 500 }
}

function revalidateStaffingPaths(serviceClientId?: string) {
  revalidatePath('/client-services')
  revalidatePath('/client-services/dept/staffing')
  if (serviceClientId) {
    revalidatePath(`/client-services/clients/${serviceClientId}`)
  }
}

export async function flagAssignmentReplacement(input: {
  serviceClientId: string
  rbtProfileId: string
  reason: string
  expectedEndDate: string
}): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const user = await getClientServicesUser()
    assertCanFlagStaffingDeparture(user)
    await assertCanViewClient(user, input.serviceClientId)
    await assertCanEditClient(user, input.serviceClientId)

    const reason = input.reason?.trim()
    if (!reason) return { ok: false, error: 'Reason is required' }

    const expectedEndDate = parseExpectedEndDate(input.expectedEndDate)
    if (!expectedEndDate) {
      return { ok: false, error: 'Expected last day is required' }
    }

    const rbt = await prisma.rBTProfile.findUnique({
      where: { id: input.rbtProfileId },
      select: { id: true },
    })
    if (!rbt) return { ok: false, error: 'Behavior technician not found', status: 404 }

    const result = await flagClientRbtReplacement({
      serviceClientId: input.serviceClientId,
      rbtProfileId: input.rbtProfileId,
      reason,
      expectedEndDate,
      flaggedByUserId: user.id,
    })

    revalidateStaffingPaths(input.serviceClientId)
    return { ok: true, ...result }
  } catch (err) {
    return fail(err)
  }
}

export async function unflagAssignmentReplacement(input: {
  serviceClientId: string
  rbtProfileId: string
}): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const user = await getClientServicesUser()
    assertCanFlagStaffingDeparture(user)
    await assertCanViewClient(user, input.serviceClientId)
    await assertCanEditClient(user, input.serviceClientId)

    const result = await clearClientRbtReplacement({
      serviceClientId: input.serviceClientId,
      rbtProfileId: input.rbtProfileId,
      clearedByUserId: user.id,
    })

    revalidateStaffingPaths(input.serviceClientId)
    return { ok: true, ...result }
  } catch (err) {
    return fail(err)
  }
}

export async function flagStaffMemberDeparting(input: {
  rbtProfileId: string
  lastDay: string
  departureNote?: string | null
}): Promise<
  ActionResult<{ updatedAssignmentRows: number; affectedClientIds: string[] }>
> {
  try {
    const user = await getClientServicesUser()
    assertCanFlagStaffingDeparture(user)

    const lastDay = parseExpectedEndDate(input.lastDay)
    if (!lastDay) return { ok: false, error: 'Last day is required' }

    const profile = await prisma.rBTProfile.findUnique({
      where: { id: input.rbtProfileId },
      select: { id: true },
    })
    if (!profile) return { ok: false, error: 'Staff member not found', status: 404 }

    const result = await flagRbtStaffDeparting({
      rbtProfileId: input.rbtProfileId,
      lastDay,
      departureNote: input.departureNote,
      flaggedByUserId: user.id,
    })

    revalidateStaffingPaths()
    for (const clientId of result.affectedClientIds) {
      revalidatePath(`/client-services/clients/${clientId}`)
    }
    return { ok: true, ...result }
  } catch (err) {
    return fail(err)
  }
}

export async function unflagStaffMemberDeparting(input: {
  rbtProfileId: string
}): Promise<ActionResult<{ clearedAssignmentRows: number }>> {
  try {
    const user = await getClientServicesUser()
    assertCanFlagStaffingDeparture(user)

    const result = await clearRbtStaffDeparting({
      rbtProfileId: input.rbtProfileId,
      clearedByUserId: user.id,
    })

    revalidateStaffingPaths()
    return { ok: true, ...result }
  } catch (err) {
    return fail(err)
  }
}

export async function loadStaffDepartureStatus(rbtProfileId: string) {
  const user = await getClientServicesUser()
  assertCanFlagStaffingDeparture(user)

  return prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      departing: true,
      departureLastDay: true,
      departureNote: true,
      departureFlaggedAt: true,
    },
  })
}

export async function loadClientReplacementFlags(serviceClientId: string) {
  const user = await getClientServicesUser()
  await assertCanViewClient(user, serviceClientId)

  const rows = await prisma.rbtScheduleAssignment.findMany({
    where: {
      serviceClientId,
      deletedAt: null,
      isActive: true,
      needsReplacement: true,
      replacementResolvedAt: null,
    },
    select: {
      rbtProfileId: true,
      replacementReason: true,
      expectedEndDate: true,
      replacementFlaggedAt: true,
      rbtProfile: { select: { firstName: true, lastName: true } },
    },
    distinct: ['rbtProfileId'],
  })

  return rows.map((r) => ({
    rbtProfileId: r.rbtProfileId,
    rbtName: `${r.rbtProfile.firstName} ${r.rbtProfile.lastName}`.trim(),
    reason: r.replacementReason,
    expectedEndDate: r.expectedEndDate,
    flaggedAt: r.replacementFlaggedAt,
  }))
}
