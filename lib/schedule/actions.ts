'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertScheduleAccess, getCurrentSessionUser } from './access'
import type { ScheduleDayOfWeek, ScheduleSlotStatus, ScheduleTherapistRole } from '@prisma/client'
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
  revalidatePath('/schedule')
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
}): ReturnType<typeof serializeSlot> {
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

export async function createSlot(input: unknown) {
  const email = await assertScheduleAccess()
  const data = SlotInput.parse(input)

  // Period / assignment mode: therapistId is rbtProfileId, clientId may be synthetic
  const looksLikeAssignment =
    isSyntheticClientId(data.clientId) ||
    !!(await prisma.rBTProfile.findUnique({ where: { id: data.therapistId }, select: { id: true } }))

  if (looksLikeAssignment && isSyntheticClientId(data.clientId)) {
    const user = await getCurrentSessionUser()
    if (!user) throw new Error('Unauthorized')

    let clientName = clientNameFromId(data.clientId)
    // Prefer display name from schedule_client if we can resolve a real client later;
    // synthetic ids store lowercase — look up remembered borough client casing
    const boroughRow = await prisma.clientBorough.findFirst({
      where: { clientName: { equals: clientName, mode: 'insensitive' } },
    })
    if (boroughRow) clientName = boroughRow.clientName

    // If client id was client:key but we have the name from an existing assignment map,
    // also try schedule_weekly_client
    const weeklyClient = await prisma.scheduleWeeklyClient.findFirst({
      where: { name: { equals: clientName, mode: 'insensitive' } },
    })
    if (weeklyClient) clientName = weeklyClient.name

    const periodStart = parseIsoDate(data.periodStart ?? undefined)
    const periodEnd = parseIsoDate(data.periodEnd ?? undefined)

    const borough =
      boroughRow?.borough ??
      (await prisma.clientBorough.findFirst({
        where: { clientName: { equals: clientName, mode: 'insensitive' } },
      }))?.borough ??
      'Unset'

    const created = await prisma.rbtScheduleAssignment.create({
      data: {
        rbtProfileId: data.therapistId,
        clientName,
        dayOfWeek: DAY_TO_JS[data.day] ?? 1,
        startTime: formatMinutes(data.startMin),
        endTime: formatMinutes(data.endMin),
        location: data.placeOfService || '12-Home',
        notes: data.note ?? null,
        source: 'MANUAL',
        clientBorough: borough,
        periodStart: periodStart ?? undefined,
        periodEnd: periodEnd ?? undefined,
        createdBy: user.id,
      },
    })
    revalidate()
    return serializeAssignmentAsSlot(created)
  }

  const slot = await prisma.scheduleSessionSlot.create({
    data: {
      therapistId: data.therapistId,
      clientId: data.clientId,
      day: data.day as ScheduleDayOfWeek,
      startMin: data.startMin,
      endMin: data.endMin,
      status: data.status as ScheduleSlotStatus,
      note: data.note ?? null,
      procedureCode: data.procedureCode,
      placeOfService: data.placeOfService,
      createdBy: email,
      updatedBy: email,
    },
  })
  revalidate()
  return serializeSlot(slot)
}

export async function updateSlot(id: string, input: unknown) {
  const email = await assertScheduleAccess()
  const data = SlotInputBase.partial().parse(input)

  const assignment = await prisma.rbtScheduleAssignment.findUnique({ where: { id } })
  if (assignment) {
    let clientName = assignment.clientName
    if (data.clientId) {
      if (isSyntheticClientId(data.clientId)) {
        clientName = clientNameFromId(data.clientId)
        const row = await prisma.clientBorough.findFirst({
          where: { clientName: { equals: clientName, mode: 'insensitive' } },
        })
        if (row) clientName = row.clientName
      } else {
        const c = await prisma.scheduleWeeklyClient.findUnique({ where: { id: data.clientId } })
        if (c) clientName = c.name
      }
    }

    const startMin = data.startMin
    const endMin = data.endMin
    const dayOfWeek =
      data.day != null ? (DAY_TO_JS[data.day] ?? assignment.dayOfWeek) : assignment.dayOfWeek

    const updated = await prisma.rbtScheduleAssignment.update({
      where: { id },
      data: {
        clientName,
        dayOfWeek,
        startTime: startMin != null ? formatMinutes(startMin) : undefined,
        endTime: endMin != null ? formatMinutes(endMin) : undefined,
        location: data.placeOfService,
        notes: data.note === undefined ? undefined : data.note,
        // Manual edit of imported row → MANUAL so next import won't revert
        source: 'MANUAL',
        rbtProfileId: data.therapistId ?? undefined,
      },
    })
    revalidate()
    return serializeAssignmentAsSlot(updated)
  }

  const slot = await prisma.scheduleSessionSlot.update({
    where: { id },
    data: {
      therapistId: data.therapistId,
      clientId: data.clientId,
      day: data.day as ScheduleDayOfWeek | undefined,
      startMin: data.startMin,
      endMin: data.endMin,
      status: data.status as ScheduleSlotStatus | undefined,
      note: data.note,
      procedureCode: data.procedureCode,
      placeOfService: data.placeOfService,
      updatedBy: email,
    },
  })
  revalidate()
  return serializeSlot(slot)
}

export async function deleteSlot(id: string) {
  await assertScheduleAccess()

  const assignment = await prisma.rbtScheduleAssignment.findUnique({ where: { id } })
  if (assignment) {
    // Soft-delete so history remains; convert to MANUAL so re-import won't revive it
    await prisma.rbtScheduleAssignment.update({
      where: { id },
      data: { isActive: false, source: 'MANUAL' },
    })
    revalidate()
    return
  }

  await prisma.scheduleSessionSlot.delete({ where: { id } })
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
  const email = await assertScheduleAccess()
  const parsed = SlotInputBase.partial().parse(patch)
  const slot = await prisma.scheduleSessionSlot.update({
    where: { id },
    data: {
      ...parsed,
      day: parsed.day as ScheduleDayOfWeek | undefined,
      updatedBy: email,
    },
  })
  revalidate()
  return serializeSlot(slot)
}

export async function duplicateSlot(id: string, targetDay?: string) {
  const email = await assertScheduleAccess()
  const src = await prisma.scheduleSessionSlot.findUniqueOrThrow({ where: { id } })
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
  const idx = days.indexOf(src.day as (typeof days)[number])
  const nextDay = (targetDay as ScheduleDayOfWeek) ?? days[(idx + 1) % days.length]

  const slot = await prisma.scheduleSessionSlot.create({
    data: {
      therapistId: src.therapistId,
      clientId: src.clientId,
      day: nextDay,
      startMin: src.startMin,
      endMin: src.endMin,
      status: src.status,
      procedureCode: src.procedureCode,
      placeOfService: src.placeOfService,
      note: src.note,
      createdBy: email,
      updatedBy: email,
    },
  })
  revalidate()
  return serializeSlot(slot)
}

export async function bulkUpdateSlots(
  ids: string[],
  patch: { status?: string; therapistId?: string }
) {
  await assertScheduleAccess()
  const email = await getEmail()
  const data: Record<string, unknown> = { updatedBy: email }
  if (patch.status) data.status = patch.status as ScheduleSlotStatus
  if (patch.therapistId) data.therapistId = patch.therapistId
  await prisma.scheduleSessionSlot.updateMany({ where: { id: { in: ids } }, data })
  revalidate()
}

export async function bulkDeleteSlots(ids: string[]) {
  await assertScheduleAccess()
  if (ids.length === 0) return

  const assignments = await prisma.rbtScheduleAssignment.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })
  const assignmentIds = new Set(assignments.map((a) => a.id))
  if (assignmentIds.size > 0) {
    await prisma.rbtScheduleAssignment.updateMany({
      where: { id: { in: [...assignmentIds] } },
      data: { isActive: false, source: 'MANUAL' },
    })
  }
  const slotIds = ids.filter((id) => !assignmentIds.has(id))
  if (slotIds.length > 0) {
    await prisma.scheduleSessionSlot.deleteMany({ where: { id: { in: slotIds } } })
  }
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
  await assertScheduleAccess()
  const data = ClientInput.parse(input)
  const row = data.id
    ? await prisma.scheduleWeeklyClient.update({
        where: { id: data.id },
        data: {
          code: data.code ?? null,
          name: data.name,
          borough: data.borough?.trim() || null,
          insurance: data.insurance ?? null,
          bcba: data.bcba ?? null,
          authorizedHoursPerWeek: data.authorizedHoursPerWeek ?? null,
          active: data.active ?? true,
        },
      })
    : await prisma.scheduleWeeklyClient.create({
        data: {
          code: data.code ?? null,
          name: data.name,
          borough: data.borough?.trim() || null,
          insurance: data.insurance ?? null,
          bcba: data.bcba ?? null,
          authorizedHoursPerWeek: data.authorizedHoursPerWeek ?? null,
          active: data.active ?? true,
        },
      })
  revalidate()
  return serializeClient(row)
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
  await assertScheduleAccess()
  const data = TherapistInput.parse(input)
  const row = data.id
    ? await prisma.scheduleTherapist.update({
        where: { id: data.id },
        data: {
          name: data.name,
          email: data.email ?? null,
          role: (data.role as ScheduleTherapistRole) ?? 'RBT',
          borough: data.borough?.trim() || null,
          colorKey: data.colorKey ?? null,
          active: data.active ?? true,
        },
      })
    : await prisma.scheduleTherapist.create({
        data: {
          name: data.name,
          email: data.email ?? null,
          role: (data.role as ScheduleTherapistRole) ?? 'RBT',
          borough: data.borough?.trim() || null,
          colorKey: data.colorKey ?? null,
          active: data.active ?? true,
        },
      })
  revalidate()
  return serializeTherapist(row)
}

/** Update RBT/therapist borough for export grouping. */
export async function updateTherapistBorough(therapistId: string, borough: string | null) {
  await assertScheduleAccess()
  const row = await prisma.scheduleTherapist.update({
    where: { id: therapistId },
    data: {
      borough: borough == null || String(borough).trim() === '' ? null : String(borough).trim(),
    },
  })
  revalidate()
  return serializeTherapist(row)
}

export async function setAuthorizedHours(clientId: string, hours: number | null) {
  await assertScheduleAccess()
  const row = await prisma.scheduleWeeklyClient.update({
    where: { id: clientId },
    data: { authorizedHoursPerWeek: hours },
  })
  revalidate()
  return serializeClient(row)
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
  await assertScheduleAccess()
  const data: {
    borough?: string | null
    bcba?: string | null
    insurance?: string | null
    authorizedHoursPerWeek?: number | null
  } = {}
  if ('borough' in patch) {
    const v = patch.borough
    data.borough = v == null || String(v).trim() === '' ? null : String(v).trim()
  }
  if ('bcba' in patch) {
    const v = patch.bcba
    data.bcba = v == null || String(v).trim() === '' ? null : String(v).trim()
  }
  if ('insurance' in patch) {
    const v = patch.insurance
    data.insurance = v == null || String(v).trim() === '' ? null : String(v).trim()
  }
  if ('authorizedHoursPerWeek' in patch) {
    const h = patch.authorizedHoursPerWeek
    if (h != null && (typeof h !== 'number' || isNaN(h) || h < 0 || h > 168)) {
      throw new Error('Authorized hours must be between 0 and 168')
    }
    data.authorizedHoursPerWeek = h ?? null
  }
  const row = await prisma.scheduleWeeklyClient.update({
    where: { id: clientId },
    data,
  })
  revalidate()
  return serializeClient(row)
}

export async function addAllowedUser(email: string) {
  await assertScheduleAccess()
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
  await assertScheduleAccess()
  await prisma.scheduleAllowedUser.delete({ where: { id } })
  revalidate()
}

async function getEmail() {
  return assertScheduleAccess()
}

function serializeSlot(slot: {
  id: string
  therapistId: string
  clientId: string
  day: ScheduleDayOfWeek
  startMin: number
  endMin: number
  status: ScheduleSlotStatus
  procedureCode: string
  placeOfService: string
  note: string | null
  createdBy: string | null
  updatedBy: string | null
}) {
  return {
    id: slot.id,
    therapistId: slot.therapistId,
    clientId: slot.clientId,
    day: slot.day,
    startMin: slot.startMin,
    endMin: slot.endMin,
    status: slot.status,
    procedureCode: slot.procedureCode,
    placeOfService: slot.placeOfService,
    note: slot.note,
    createdBy: slot.createdBy,
    updatedBy: slot.updatedBy,
  }
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
