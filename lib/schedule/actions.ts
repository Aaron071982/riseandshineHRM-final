'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { assertScheduleAccess } from './access'
import type { ScheduleDayOfWeek, ScheduleSlotStatus, ScheduleTherapistRole } from '@prisma/client'

const Day = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
const Status = z.enum(['CONFIRMED', 'TENTATIVE', 'NEEDS_REVIEW', 'CANCELLED'])
const Role = z.enum(['RBT', 'BT', 'BCBA', 'BCaBA', 'CLINICAL_DIRECTOR'])

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
})

const SlotInput = SlotInputBase.refine((v) => v.endMin > v.startMin, {
  message: 'End must be after start',
  path: ['endMin'],
})

function revalidate() {
  revalidatePath('/schedule')
}

export async function createSlot(input: unknown) {
  const email = await assertScheduleAccess()
  const data = SlotInput.parse(input)
  const slot = await prisma.scheduleSessionSlot.create({
    data: {
      ...data,
      day: data.day as ScheduleDayOfWeek,
      status: data.status as ScheduleSlotStatus,
      note: data.note ?? null,
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
  const slot = await prisma.scheduleSessionSlot.update({
    where: { id },
    data: {
      ...data,
      day: data.day as ScheduleDayOfWeek | undefined,
      status: data.status as ScheduleSlotStatus | undefined,
      updatedBy: email,
    },
  })
  revalidate()
  return serializeSlot(slot)
}

export async function deleteSlot(id: string) {
  await assertScheduleAccess()
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
  await prisma.scheduleSessionSlot.deleteMany({ where: { id: { in: ids } } })
  revalidate()
}

const ClientInput = z.object({
  id: z.string().optional(),
  code: z.string().max(20).optional().nullable(),
  name: z.string().min(1),
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
          colorKey: data.colorKey ?? null,
          active: data.active ?? true,
        },
      })
    : await prisma.scheduleTherapist.create({
        data: {
          name: data.name,
          email: data.email ?? null,
          role: (data.role as ScheduleTherapistRole) ?? 'RBT',
          colorKey: data.colorKey ?? null,
          active: data.active ?? true,
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

/** Partial update for Client hours tab (bcba / insurance / authorized hours). */
export async function updateClientMeta(
  clientId: string,
  patch: {
    bcba?: string | null
    insurance?: string | null
    authorizedHoursPerWeek?: number | null
  }
) {
  await assertScheduleAccess()
  const data: {
    bcba?: string | null
    insurance?: string | null
    authorizedHoursPerWeek?: number | null
  } = {}
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
  insurance: string | null
  bcba: string | null
  authorizedHoursPerWeek: unknown
  active: boolean
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
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
  colorKey: number | null
  active: boolean
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    colorKey: row.colorKey,
    active: row.active,
  }
}
