import { z } from 'zod'
import type { ScheduleClient, ScheduleSlot } from '@/lib/schedule/types'
import { hoursOf } from '@/lib/schedule/utils'

/**
 * A scenario is a sandbox overlay on the live schedule: paused clients plus added /
 * removed / edited sessions. Applying it never mutates the live slots it is given.
 */

const Day = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
const Status = z.enum(['CONFIRMED', 'TENTATIVE', 'NEEDS_REVIEW', 'CANCELLED'])

const slotFields = {
  therapistId: z.string().min(1).max(200),
  clientId: z.string().min(1).max(300),
  day: Day,
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  status: Status,
  procedureCode: z.string().max(20),
  placeOfService: z.string().max(60),
  note: z.string().max(500).nullable(),
}

const ScenarioSlot = z.object({
  id: z.string().min(1).max(100),
  ...slotFields,
  createdBy: z.string().max(200).nullable(),
  updatedBy: z.string().max(200).nullable(),
})

const SlotEdit = z.object(slotFields).partial()

export const ScenarioChangesSchema = z.object({
  pausedClients: z.array(z.object({ id: z.string().max(300), name: z.string().max(300) })).max(2000).default([]),
  removedSlotIds: z.array(z.string().max(100)).max(5000).default([]),
  slotEdits: z.record(z.string().max(100), SlotEdit).default({}),
  addedSlots: z.array(ScenarioSlot).max(5000).default([]),
})

export type ScenarioChanges = z.infer<typeof ScenarioChangesSchema>
export type ScenarioSlotEdit = z.infer<typeof SlotEdit>
export type PausedClient = ScenarioChanges['pausedClients'][number]

export const EMPTY_SCENARIO_CHANGES: ScenarioChanges = {
  pausedClients: [],
  removedSlotIds: [],
  slotEdits: {},
  addedSlots: [],
}

export const SCENARIO_SLOT_PREFIX = 'scn:'

export function parseScenarioChanges(raw: unknown): ScenarioChanges {
  const parsed = ScenarioChangesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : { ...EMPTY_SCENARIO_CHANGES }
}

export function normalizeClientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function clientNameFor(clientId: string, clients: Map<string, ScheduleClient>): string {
  const c = clients.get(clientId)
  if (c) return c.name
  return clientId.startsWith('client:') ? clientId.slice('client:'.length) : clientId
}

/** Paused by record id, or by name so name-only (unlinked) sessions for the same child are paused too. */
export function pausedClientMatcher(changes: ScenarioChanges, clients: ScheduleClient[]) {
  const ids = new Set(changes.pausedClients.map((p) => p.id))
  const names = new Set(changes.pausedClients.map((p) => normalizeClientName(p.name)))
  const byId = new Map(clients.map((c) => [c.id, c]))
  return (clientId: string) =>
    ids.has(clientId) || names.has(normalizeClientName(clientNameFor(clientId, byId)))
}

export function applyScenario(
  slots: ScheduleSlot[],
  clients: ScheduleClient[],
  changes: ScenarioChanges
): ScheduleSlot[] {
  const removed = new Set(changes.removedSlotIds)
  const isPaused = pausedClientMatcher(changes, clients)
  const out: ScheduleSlot[] = []
  for (const s of slots) {
    if (removed.has(s.id)) continue
    const edit = changes.slotEdits[s.id]
    out.push(edit ? { ...s, ...edit } : s)
  }
  out.push(...changes.addedSlots)
  return out.filter((s) => !isPaused(s.clientId))
}

export type SlotDraft = Omit<ScheduleSlot, 'id' | 'createdBy' | 'updatedBy'>

export function scenarioCreateSlot(
  changes: ScenarioChanges,
  draft: SlotDraft,
  id: string
): { changes: ScenarioChanges; slot: ScheduleSlot } {
  const slot: ScheduleSlot = { ...draft, id: `${SCENARIO_SLOT_PREFIX}${id}`, createdBy: null, updatedBy: null }
  return { changes: { ...changes, addedSlots: [...changes.addedSlots, slot] }, slot }
}

export function scenarioUpdateSlot(
  changes: ScenarioChanges,
  current: ScheduleSlot,
  patch: ScenarioSlotEdit
): { changes: ScenarioChanges; slot: ScheduleSlot } {
  const slot = { ...current, ...patch }
  if (current.id.startsWith(SCENARIO_SLOT_PREFIX)) {
    return {
      changes: { ...changes, addedSlots: changes.addedSlots.map((s) => (s.id === current.id ? slot : s)) },
      slot,
    }
  }
  return {
    changes: {
      ...changes,
      slotEdits: { ...changes.slotEdits, [current.id]: { ...changes.slotEdits[current.id], ...patch } },
    },
    slot,
  }
}

export function scenarioDeleteSlot(changes: ScenarioChanges, id: string): ScenarioChanges {
  if (id.startsWith(SCENARIO_SLOT_PREFIX)) {
    return { ...changes, addedSlots: changes.addedSlots.filter((s) => s.id !== id) }
  }
  const { [id]: _dropped, ...slotEdits } = changes.slotEdits
  return {
    ...changes,
    slotEdits,
    removedSlotIds: changes.removedSlotIds.includes(id) ? changes.removedSlotIds : [...changes.removedSlotIds, id],
  }
}

export function scenarioPauseClient(changes: ScenarioChanges, client: PausedClient): ScenarioChanges {
  if (changes.pausedClients.some((p) => p.id === client.id)) return changes
  return { ...changes, pausedClients: [...changes.pausedClients, client] }
}

export function scenarioResumeClient(changes: ScenarioChanges, clientId: string): ScenarioChanges {
  return { ...changes, pausedClients: changes.pausedClients.filter((p) => p.id !== clientId) }
}

export function scenarioChangeCount(changes: ScenarioChanges): number {
  return (
    changes.pausedClients.length +
    changes.removedSlotIds.length +
    Object.keys(changes.slotEdits).length +
    changes.addedSlots.length
  )
}

export type PayerSummary = { payer: string; clients: number; hours: number }

export type ScheduleSummary = {
  clientsServed: number
  therapistsWorking: number
  sessions: number
  weeklyHours: number
  authorizedHours: number
  byPayer: PayerSummary[]
}

/** Totals for the active (non-cancelled) sessions in a schedule. */
export function summarizeSchedule(slots: ScheduleSlot[], clients: ScheduleClient[]): ScheduleSummary {
  const active = slots.filter((s) => s.status !== 'CANCELLED')
  const byId = new Map(clients.map((c) => [c.id, c]))
  const hoursByClient = new Map<string, number>()
  const therapists = new Set<string>()
  for (const s of active) {
    hoursByClient.set(s.clientId, (hoursByClient.get(s.clientId) ?? 0) + hoursOf(s))
    therapists.add(s.therapistId)
  }

  const payers = new Map<string, PayerSummary>()
  let authorizedHours = 0
  for (const [clientId, hours] of Array.from(hoursByClient.entries())) {
    const client = byId.get(clientId)
    authorizedHours += client?.authorizedHoursPerWeek ?? 0
    const payer = client?.insurance?.trim() || 'Unknown payer'
    const row = payers.get(payer) ?? { payer, clients: 0, hours: 0 }
    row.clients += 1
    row.hours += hours
    payers.set(payer, row)
  }

  return {
    clientsServed: hoursByClient.size,
    therapistsWorking: therapists.size,
    sessions: active.length,
    weeklyHours: Array.from(hoursByClient.values()).reduce((a, b) => a + b, 0),
    authorizedHours,
    byPayer: Array.from(payers.values()).sort((a, b) => b.hours - a.hours),
  }
}
