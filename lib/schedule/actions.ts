'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { namesMatch } from '@/lib/rbt-schedule/from-roster'
import { matchScheduleNameToClient } from '@/lib/client-services/scheduleSync'
import { CRM_SCHEDULE_PATH } from '@/lib/schedule/paths'
import { SCHEDULABLE_RBT_WHERE } from '@/lib/rbt/schedulable'
import { canAccessCrmSchedule, getClientServicesUser, isFullAccess, CrmAccessError } from '@/lib/crm/access'
import {
  assertScheduleAssignmentIdsEdit,
  assertScheduleClientEdit,
} from '@/lib/schedule/clientScope'
import { softDeleteData } from '@/lib/crm/softDelete'
import type { ScheduleDayOfWeek, ScheduleTherapistRole } from '@prisma/client'
import { formatMinutes } from '@/lib/rbt-schedule/utils'

const Day = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
const Status = z.enum(['CONFIRMED', 'TENTATIVE', 'NEEDS_REVIEW', 'CANCELLED'])
const Role = z.enum(['RBT', 'BT', 'BCBA', 'BCaBA', 'CLINICAL_DIRECTOR'])

const DAY_TO_JS: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
}
const JS_TO_DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

const SlotInputBase = z.object({
  therapistId: z.string().min(1),
  clientId: z.string().min(1),
  day: Day,
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  status: Status.default('CONFIRMED'),
  note: z.string().max(500).optional().nullable(),
  procedureCode: z.string().optional(),
  placeOfService: z.string().optional(),
  /** When set, create/update as period assignment (Artemis import mode). */
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
})

const SlotInput = SlotInputBase.refine((v) => v.endMin > v.startMin, {
  message: 'End must be after start',
  path: ['endMin'],
})

function revalidate() {
  revalidatePath(CRM_SCHEDULE_PATH)
  revalidatePath('/schedule')
  revalidatePath('/client-services')
}

async function assertCrmScheduleUser() {
  const user = await getClientServicesUser()
  if (!canAccessCrmSchedule(user)) throw new Error('FORBIDDEN')
  return user
}

function rethrowScheduleAccess(err: unknown): never {
  if (err instanceof CrmAccessError) throw new Error('FORBIDDEN')
  throw err
}

function isSyntheticClientId(id: string): boolean {
  return id.startsWith('client:')
}

function clientNameFromId(clientId: string, fallbackName?: string): string {
  if (isSyntheticClientId(clientId)) {
    return clientId.slice('client:'.length)
  }
  return fallbackName ?? clientId
}

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function serializeAssignmentAsSlot(a: {
  id: string
  rbtProfileId: string
  clientName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string | null
  notes: string | null
  createdBy: string
}): {
  id: string
  therapistId: string
  clientId: string
  day: ScheduleDayOfWeek
  startMin: number
  endMin: number
  status: 'CONFIRMED'
  procedureCode: string
  placeOfService: string
  note: string | null
  createdBy: string
  updatedBy: null
} {
  const [sh, sm] = a.startTime.split(':').map(Number)
  const [eh, em] = a.endTime.split(':').map(Number)
  return {
    id: a.id,
    therapistId: a.rbtProfileId,
    clientId: `client:${a.clientName.trim().toLowerCase()}`,
    day: JS_TO_DAY[a.dayOfWeek] as ScheduleDayOfWeek,
    startMin: sh * 60 + sm,
    endMin: eh * 60 + em,
    status: 'CONFIRMED',
    procedureCode: '97153',
    placeOfService: a.location || '12-Home',
    note: a.notes,
    createdBy: a.createdBy,
    updatedBy: null,
  }
}

async function resolveRbtProfileId(therapistId: string): Promise<string> {
  const asRbt = await prisma.rBTProfile.findUnique({
    where: { id: therapistId },
    select: { id: true },
  })
  if (asRbt) return asRbt.id

  const board = await prisma.scheduleTherapist.findUnique({
    where: { id: therapistId },
    select: { name: true, email: true },
  })
  if (!board) throw new Error('Therapist not found')

  const email = board.email?.trim().toLowerCase()
  if (email) {
    const byEmail = await prisma.rBTProfile.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (byEmail) return byEmail.id
  }

  const rbts = await prisma.rBTProfile.findMany({
    where: SCHEDULABLE_RBT_WHERE,
    select: { id: true, firstName: true, lastName: true },
  })
  const hits = rbts.filter((r) =>
    namesMatch(board.name, `${r.firstName} ${r.lastName}`.trim())
  )
  if (hits.length === 1) return hits[0].id
  throw new Error('Cannot map board therapist to an RBT profile')
}

async function resolveClient(
  clientId: string
): Promise<{ clientName: string; serviceClientId: string | null; borough: string | null }> {
  if (!isSyntheticClientId(clientId)) {
    const service = await prisma.serviceClient.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, borough: true },
    })
    if (service) {
      return {
        clientName: `${service.firstName} ${service.lastName}`.trim(),
        serviceClientId: service.id,
        borough: service.borough,
      }
    }
  }

  let clientName = isSyntheticClientId(clientId) ? clientNameFromId(clientId) : clientId
  const boroughRow = await prisma.clientBorough.findFirst({
    where: { clientName: { equals: clientName, mode: 'insensitive' } },
  })
  if (boroughRow) clientName = boroughRow.clientName

  const serviceClients = await prisma.serviceClient.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, borough: true },
  })
  const match = matchScheduleNameToClient(clientName, serviceClients)
  const sc = match ? serviceClients.find((c) => c.id === match.id) : null
  if (sc) {
    return {
      clientName: `${sc.firstName} ${sc.lastName}`.trim(),
      serviceClientId: sc.id,
      borough: sc.borough ?? boroughRow?.borough ?? null,
    }
  }

  return {
    clientName,
    serviceClientId: null,
    borough: boroughRow?.borough ?? null,
  }
}

export async function createSlot(input: unknown) {
  const user = await assertCrmScheduleUser()
  const data = SlotInput.parse(input)

  const rbtProfileId = await resolveRbtProfileId(data.therapistId)
  const resolved = await resolveClient(data.clientId)
  try {
    await assertScheduleClientEdit(user, resolved.serviceClientId)
  } catch (err) {
    rethrowScheduleAccess(err)
  }
  const periodStart = parseIsoDate(data.periodStart ?? undefined)
  const periodEnd = parseIsoDate(data.periodEnd ?? undefined)

  const created = await prisma.rbtScheduleAssignment.create({
    data: {
      rbtProfileId,
      clientName: resolved.clientName,
      dayOfWeek: DAY_TO_JS[data.day] ?? 1,
      startTime: formatMinutes(data.startMin),
      endTime: formatMinutes(data.endMin),
      location: data.placeOfService || '12-Home',
      notes: data.note ?? null,
      isActive: true,
      source: 'MANUAL',
      reviewStatus: 'NONE',
      clientBorough: resolved.borough || 'Unset',
      periodStart: periodStart ?? undefined,
      periodEnd: periodEnd ?? undefined,
      serviceClientId: resolved.serviceClientId,
      createdBy: user.id,
    },
  })
  revalidate()
  return serializeAssignmentAsSlot(created)
}

export async function updateSlot(id: string, input: unknown) {
  const user = await assertCrmScheduleUser()
  const data = SlotInputBase.partial().parse(input)

  const assignment = await prisma.rbtScheduleAssignment.findFirst({
    where: { id, deletedAt: null },
  })
  if (!assignment) throw new Error('Session not found')

  try {
    await assertScheduleClientEdit(user, assignment.serviceClientId)
  } catch (err) {
    rethrowScheduleAccess(err)
  }

  let clientName = assignment.clientName
  let serviceClientId = assignment.serviceClientId
  if (data.clientId) {
    const resolved = await resolveClient(data.clientId)
    try {
      await assertScheduleClientEdit(user, resolved.serviceClientId)
    } catch (err) {
      rethrowScheduleAccess(err)
    }
    clientName = resolved.clientName
    serviceClientId = resolved.serviceClientId
  }

  const rbtProfileId = data.therapistId
    ? await resolveRbtProfileId(data.therapistId)
    : assignment.rbtProfileId

  const startMin = data.startMin
  const endMin = data.endMin
  const dayOfWeek =
    data.day != null ? (DAY_TO_JS[data.day] ?? assignment.dayOfWeek) : assignment.dayOfWeek

  const updated = await prisma.rbtScheduleAssignment.update({
    where: { id },
    data: {
      clientName,
      serviceClientId,
      dayOfWeek,
      startTime: startMin != null ? formatMinutes(startMin) : undefined,
      endTime: endMin != null ? formatMinutes(endMin) : undefined,
      location: data.placeOfService,
      notes: data.note === undefined ? undefined : data.note,
      source: 'MANUAL',
      reviewStatus: assignment.reviewStatus === 'PENDING' ? 'PENDING' : 'NONE',
      rbtProfileId,
    },
  })
  revalidate()
  return serializeAssignmentAsSlot(updated)
}

export async function deleteSlot(id: string) {
  const user = await assertCrmScheduleUser()

  const assignment = await prisma.rbtScheduleAssignment.findFirst({
    where: { id, deletedAt: null },
  })
  if (!assignment) throw new Error('Session not found')

  try {
    await assertScheduleClientEdit(user, assignment.serviceClientId)
  } catch (err) {
    rethrowScheduleAccess(err)
  }

  await prisma.rbtScheduleAssignment.update({
    where: { id },
    data: { isActive: false, source: 'MANUAL', ...softDeleteData(user.id) },
  })
  revalidate()
}

export async function moveSlot(
  id: string,
  patch: {
    day?: string
    startMin?: number
    endMin?: number
    therapistId?: string
    clientId?: string
  }
) {
  return updateSlot(id, patch)
}

export async function duplicateSlot(id: string, targetDay?: string) {
  const user = await assertCrmScheduleUser()
  const src = await prisma.rbtScheduleAssignment.findFirst({
    where: { id, deletedAt: null },
  })
  if (!src) throw new Error('Session not found')

  try {
    await assertScheduleClientEdit(user, src.serviceClientId)
  } catch (err) {
    rethrowScheduleAccess(err)
  }

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
  const nextDayEnum = (targetDay as (typeof days)[number] | undefined) ?? days[(src.dayOfWeek + 1) % 7]
  const nextDay = DAY_TO_JS[nextDayEnum] ?? ((src.dayOfWeek + 1) % 7)

  const created = await prisma.rbtScheduleAssignment.create({
    data: {
      rbtProfileId: src.rbtProfileId,
      clientName: src.clientName,
      dayOfWeek: nextDay,
      startTime: src.startTime,
      endTime: src.endTime,
      location: src.location,
      notes: src.notes,
      isActive: true,
      source: 'MANUAL',
      reviewStatus: 'NONE',
      clientBorough: src.clientBorough,
      periodStart: src.periodStart,
      periodEnd: src.periodEnd,
      serviceClientId: src.serviceClientId,
      createdBy: user.id,
    },
  })
  revalidate()
  return serializeAssignmentAsSlot(created)
}

export async function bulkUpdateSlots(
  ids: string[],
  patch: { status?: string; therapistId?: string }
) {
  const user = await assertCrmScheduleUser()
  if (ids.length === 0) return
  try {
    await assertScheduleAssignmentIdsEdit(user, ids)
  } catch (err) {
    rethrowScheduleAccess(err)
  }
  const rbtProfileId = patch.therapistId
    ? await resolveRbtProfileId(patch.therapistId)
    : undefined
  await prisma.rbtScheduleAssignment.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: {
      source: 'MANUAL',
      ...(rbtProfileId ? { rbtProfileId } : {}),
    },
  })
  revalidate()
}

export async function bulkDeleteSlots(ids: string[]) {
  const user = await assertCrmScheduleUser()
  if (ids.length === 0) return
  try {
    await assertScheduleAssignmentIdsEdit(user, ids)
  } catch (err) {
    rethrowScheduleAccess(err)
  }
  await prisma.rbtScheduleAssignment.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { isActive: false, source: 'MANUAL', ...softDeleteData(user.id) },
  })
  revalidate()
}

const ClientInput = z.object({
  id: z.string().optional(),
  code: z.string().max(20).optional().nullable(),
  name: z.string().min(1),
  borough: z.string().max(60).optional().nullable(),
  insurance: z.string().optional().nullable(),
  bcba: z.string().optional().nullable(),
  authorizedHoursPerWeek: z.number().min(0).max(168).optional().nullable(),
  active: z.boolean().optional(),
})

export async function upsertClient(input: unknown) {
  const user = await assertCrmScheduleUser()
  const data = ClientInput.parse(input)
  const name = data.name.trim()
  const borough = data.borough?.trim() || 'Unset'

  if (data.authorizedHoursPerWeek != null) {
    const scs = await prisma.serviceClient.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    })
    const match = matchScheduleNameToClient(name, scs)
    if (match) {
      try {
        await assertScheduleClientEdit(user, match.id)
      } catch (err) {
        rethrowScheduleAccess(err)
      }
    } else if (!isFullAccess(user)) {
      throw new Error('FORBIDDEN')
    }
  }

  await prisma.clientBorough.upsert({
    where: { clientName: name },
    create: { clientName: name, borough, updatedById: user.id },
    update: { borough, updatedById: user.id },
  })

  await prisma.rbtScheduleAssignment.updateMany({
    where: { clientName: { equals: name, mode: 'insensitive' }, deletedAt: null },
    data: { clientBorough: borough },
  })

  if (data.authorizedHoursPerWeek != null) {
    const scs = await prisma.serviceClient.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    })
    const match = matchScheduleNameToClient(name, scs)
    if (match) {
      await prisma.serviceClient.update({
        where: { id: match.id },
        data: { authHours: data.authorizedHoursPerWeek },
      })
    }
  }

  revalidate()
  return serializeClient({
    id: `client:${name.toLowerCase()}`,
    code: data.code ?? null,
    name,
    borough: borough === 'Unset' ? null : borough,
    insurance: data.insurance ?? null,
    bcba: data.bcba ?? null,
    authorizedHoursPerWeek: data.authorizedHoursPerWeek ?? null,
    active: data.active ?? true,
  })
}

const TherapistInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  role: Role.optional(),
  borough: z.string().max(60).optional().nullable(),
  colorKey: z.number().int().optional().nullable(),
  active: z.boolean().optional(),
})

export async function upsertTherapist(input: unknown) {
  await assertCrmScheduleUser()
  const data = TherapistInput.parse(input)
  const id = data.id ?? (await resolveRbtProfileIdFromName(data.name, data.email))
  revalidate()
  return serializeTherapist({
    id,
    name: data.name,
    email: data.email ?? null,
    role: (data.role as ScheduleTherapistRole) ?? 'RBT',
    borough: data.borough?.trim() || null,
    colorKey: data.colorKey ?? null,
    active: data.active ?? true,
  })
}

async function resolveRbtProfileIdFromName(name: string, email?: string | null): Promise<string> {
  if (email) {
    const byEmail = await prisma.rBTProfile.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (byEmail) return byEmail.id
  }
  const rbts = await prisma.rBTProfile.findMany({
    where: SCHEDULABLE_RBT_WHERE,
    select: { id: true, firstName: true, lastName: true },
  })
  const hits = rbts.filter((r) =>
    namesMatch(name, `${r.firstName} ${r.lastName}`.trim())
  )
  if (hits.length === 1) return hits[0].id
  throw new Error('Board therapists are read-only — pick an existing RBT profile')
}

/** Update RBT/therapist borough for export grouping. */
export async function updateTherapistBorough(therapistId: string, borough: string | null) {
  await assertCrmScheduleUser()
  const rbt = await prisma.rBTProfile.findUnique({
    where: { id: therapistId },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  if (!rbt) throw new Error('Board therapists are read-only')
  revalidate()
  return serializeTherapist({
    id: rbt.id,
    name: `${rbt.firstName} ${rbt.lastName}`.trim(),
    email: rbt.email,
    role: 'RBT',
    borough: borough == null || String(borough).trim() === '' ? null : String(borough).trim(),
    colorKey: null,
    active: true,
  })
}

export async function setAuthorizedHours(clientId: string, hours: number | null) {
  return updateClientMeta(clientId, { authorizedHoursPerWeek: hours })
}

/** Partial update for Client hours tab (borough / bcba / insurance / authorized hours). */
export async function updateClientMeta(
  clientId: string,
  patch: {
    borough?: string | null
    bcba?: string | null
    insurance?: string | null
    authorizedHoursPerWeek?: number | null
  }
) {
  const user = await assertCrmScheduleUser()
  const resolved = await resolveClient(clientId)
  if (resolved.serviceClientId) {
    try {
      await assertScheduleClientEdit(user, resolved.serviceClientId)
    } catch (err) {
      rethrowScheduleAccess(err)
    }
  } else if (!isFullAccess(user)) {
    throw new Error('FORBIDDEN')
  }
  if ('borough' in patch) {
    const borough =
      patch.borough == null || String(patch.borough).trim() === ''
        ? 'Unset'
        : String(patch.borough).trim()
    await prisma.clientBorough.upsert({
      where: { clientName: resolved.clientName },
      create: {
        clientName: resolved.clientName,
        borough,
        updatedById: user.id,
      },
      update: { borough, updatedById: user.id },
    })
    await prisma.rbtScheduleAssignment.updateMany({
      where: {
        clientName: { equals: resolved.clientName, mode: 'insensitive' },
        deletedAt: null,
      },
      data: { clientBorough: borough },
    })
    if (resolved.serviceClientId) {
      await prisma.serviceClient.update({
        where: { id: resolved.serviceClientId },
        data: { borough: borough === 'Unset' ? null : borough },
      })
    }
  }
  if ('authorizedHoursPerWeek' in patch && resolved.serviceClientId) {
    const h = patch.authorizedHoursPerWeek
    if (h != null && (typeof h !== 'number' || isNaN(h) || h < 0 || h > 168)) {
      throw new Error('Authorized hours must be between 0 and 168')
    }
    await prisma.serviceClient.update({
      where: { id: resolved.serviceClientId },
      data: { authHours: h ?? null },
    })
  }
  revalidate()
  return serializeClient({
    id: resolved.serviceClientId ?? `client:${resolved.clientName.toLowerCase()}`,
    code: null,
    name: resolved.clientName,
    borough: resolved.borough,
    insurance: patch.insurance ?? null,
    bcba: patch.bcba ?? null,
    authorizedHoursPerWeek: patch.authorizedHoursPerWeek ?? null,
    active: true,
  })
}

export async function addAllowedUser(email: string) {
  const user = await assertCrmScheduleUser()
  if (!isFullAccess(user)) throw new Error('FORBIDDEN')
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) throw new Error('Invalid email')
  await prisma.scheduleAllowedUser.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  })
  revalidate()
}

export async function removeAllowedUser(id: string) {
  const user = await assertCrmScheduleUser()
  if (!isFullAccess(user)) throw new Error('FORBIDDEN')
  await prisma.scheduleAllowedUser.delete({ where: { id } })
  revalidate()
}

function serializeClient(row: {
  id: string
  code: string | null
  name: string
  borough: string | null
  insurance: string | null
  bcba: string | null
  authorizedHoursPerWeek: unknown
  active: boolean
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    borough: row.borough,
    insurance: row.insurance,
    bcba: row.bcba,
    authorizedHoursPerWeek:
      row.authorizedHoursPerWeek != null ? Number(row.authorizedHoursPerWeek) : null,
    active: row.active,
  }
}

function serializeTherapist(row: {
  id: string
  name: string
  email: string | null
  role: ScheduleTherapistRole
  borough: string | null
  colorKey: number | null
  active: boolean
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    borough: row.borough,
    colorKey: row.colorKey,
    active: row.active,
  }
}
