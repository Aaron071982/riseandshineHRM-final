'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { canAccessCrmSchedule, getClientServicesUser, isFullAccess } from '@/lib/crm/access'
import { softDeleteData } from '@/lib/crm/softDelete'
import {
  EMPTY_SCENARIO_CHANGES,
  ScenarioChangesSchema,
  parseScenarioChanges,
  type ScenarioChanges,
} from '@/lib/schedule/scenario'

export type ScheduleScenarioDto = {
  id: string
  name: string
  notes: string | null
  changes: ScenarioChanges
  updatedAt: string
}

/** Scenarios span every client, so they are limited to full-access schedule users. */
async function assertScenarioUser() {
  const user = await getClientServicesUser()
  if (!canAccessCrmSchedule(user) || !isFullAccess(user)) throw new Error('FORBIDDEN')
  return user
}

function toDto(row: { id: string; name: string; notes: string | null; changes: unknown; updatedAt: Date }): ScheduleScenarioDto {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    changes: parseScenarioChanges(row.changes),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listScheduleScenarios(): Promise<ScheduleScenarioDto[]> {
  await assertScenarioUser()
  const rows = await prisma.scheduleScenario.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toDto)
}

const Name = z.string().trim().min(1).max(80)

export async function createScheduleScenario(input: unknown): Promise<ScheduleScenarioDto> {
  const user = await assertScenarioUser()
  const data = z
    .object({ name: Name, copyFromId: z.string().optional(), changes: ScenarioChangesSchema.optional() })
    .parse(input)
  let changes: ScenarioChanges = data.changes ?? EMPTY_SCENARIO_CHANGES
  if (data.copyFromId) {
    const src = await prisma.scheduleScenario.findFirst({ where: { id: data.copyFromId, deletedAt: null } })
    if (src) changes = parseScenarioChanges(src.changes)
  }
  const row = await prisma.scheduleScenario.create({
    data: { name: data.name, changes, createdByUserId: user.id, updatedByUserId: user.id },
  })
  return toDto(row)
}

export async function updateScheduleScenario(id: string, input: unknown): Promise<ScheduleScenarioDto> {
  const user = await assertScenarioUser()
  const data = z
    .object({
      name: Name.optional(),
      notes: z.string().max(4000).nullable().optional(),
      changes: ScenarioChangesSchema.optional(),
    })
    .parse(input)
  const existing = await prisma.scheduleScenario.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw new Error('Scenario not found')
  const row = await prisma.scheduleScenario.update({
    where: { id },
    data: { ...data, updatedByUserId: user.id },
  })
  return toDto(row)
}

export async function deleteScheduleScenario(id: string): Promise<void> {
  const user = await assertScenarioUser()
  await prisma.scheduleScenario.updateMany({
    where: { id, deletedAt: null },
    data: softDeleteData(user.id),
  })
}
