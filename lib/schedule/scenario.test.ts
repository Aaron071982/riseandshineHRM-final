import { describe, expect, it } from 'vitest'
import type { ScheduleClient, ScheduleSlot } from '@/lib/schedule/types'
import {
  EMPTY_SCENARIO_CHANGES,
  applyScenario,
  parseScenarioChanges,
  scenarioChangeCount,
  scenarioCreateSlot,
  scenarioDeleteSlot,
  scenarioPauseClient,
  scenarioResumeClient,
  scenarioUpdateSlot,
  summarizeSchedule,
} from './scenario'

function client(id: string, name: string, extra: Partial<ScheduleClient> = {}): ScheduleClient {
  return {
    id,
    code: null,
    name,
    borough: null,
    insurance: 'Medicaid',
    bcba: null,
    authorizedHoursPerWeek: 10,
    active: true,
    stage: null,
    ...extra,
  }
}

function slot(id: string, clientId: string, extra: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id,
    therapistId: 't1',
    clientId,
    day: 'MON',
    startMin: 840,
    endMin: 960,
    status: 'CONFIRMED',
    procedureCode: '97153',
    placeOfService: '12-Home',
    note: null,
    createdBy: null,
    updatedBy: null,
    ...extra,
  }
}

const clients = [
  client('c1', 'Anabia Amin'),
  client('c2', 'Diar Sata', { insurance: 'EmblemHealth' }),
]
const slots = [slot('s1', 'c1'), slot('s2', 'c2', { therapistId: 't2' }), slot('s3', 'client:alayna tahreen')]

describe('applyScenario', () => {
  it('returns the live slots unchanged for an empty scenario and never mutates them', () => {
    const before = JSON.stringify(slots)
    expect(applyScenario(slots, clients, EMPTY_SCENARIO_CHANGES)).toEqual(slots)
    expect(JSON.stringify(slots)).toBe(before)
  })

  it('drops every session for a paused client', () => {
    const changes = scenarioPauseClient(EMPTY_SCENARIO_CHANGES, { id: 'c1', name: 'Anabia Amin' })
    expect(applyScenario(slots, clients, changes).map((s) => s.id)).toEqual(['s2', 's3'])
  })

  it('pauses name-only (unlinked) sessions by matching the client name', () => {
    const changes = scenarioPauseClient(EMPTY_SCENARIO_CHANGES, { id: 'svc-99', name: '  Alayna   Tahreen ' })
    expect(applyScenario(slots, clients, changes).map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('applies edits, removals and additions on top of the live schedule', () => {
    let changes = scenarioUpdateSlot(EMPTY_SCENARIO_CHANGES, slots[0], { therapistId: 't9' }).changes
    changes = scenarioDeleteSlot(changes, 's2')
    changes = scenarioCreateSlot(changes, slot('x', 'c2'), 'abc').changes

    const out = applyScenario(slots, clients, changes)
    expect(out.map((s) => s.id)).toEqual(['s1', 's3', 'scn:abc'])
    expect(out[0].therapistId).toBe('t9')
    expect(slots[0].therapistId).toBe('t1')
  })
})

describe('scenario edits', () => {
  it('updates and deletes added sessions in place instead of recording edits', () => {
    const { changes: added, slot: s } = scenarioCreateSlot(EMPTY_SCENARIO_CHANGES, slot('x', 'c1'), 'new')
    const { changes: edited } = scenarioUpdateSlot(added, s, { endMin: 1020 })
    expect(edited.slotEdits).toEqual({})
    expect(edited.addedSlots[0].endMin).toBe(1020)
    expect(scenarioDeleteSlot(edited, s.id).addedSlots).toEqual([])
  })

  it('deleting a live session discards its pending edit and is recorded once', () => {
    let changes = scenarioUpdateSlot(EMPTY_SCENARIO_CHANGES, slots[0], { endMin: 1000 }).changes
    changes = scenarioDeleteSlot(scenarioDeleteSlot(changes, 's1'), 's1')
    expect(changes.slotEdits).toEqual({})
    expect(changes.removedSlotIds).toEqual(['s1'])
  })

  it('pause is idempotent and resume undoes it', () => {
    const p = { id: 'c1', name: 'Anabia Amin' }
    const paused = scenarioPauseClient(scenarioPauseClient(EMPTY_SCENARIO_CHANGES, p), p)
    expect(scenarioChangeCount(paused)).toBe(1)
    expect(scenarioResumeClient(paused, 'c1').pausedClients).toEqual([])
  })

  it('parses stored JSON defensively', () => {
    expect(parseScenarioChanges(null)).toEqual(EMPTY_SCENARIO_CHANGES)
    expect(parseScenarioChanges({ pausedClients: 'nope' })).toEqual(EMPTY_SCENARIO_CHANGES)
    expect(parseScenarioChanges({ pausedClients: [{ id: 'c1', name: 'A' }] }).pausedClients).toHaveLength(1)
  })
})

describe('summarizeSchedule', () => {
  it('totals clients, hours and payers, ignoring cancelled sessions', () => {
    const summary = summarizeSchedule(
      [...slots, slot('s4', 'c2', { status: 'CANCELLED' })],
      clients
    )
    expect(summary.clientsServed).toBe(3)
    expect(summary.therapistsWorking).toBe(2)
    expect(summary.sessions).toBe(3)
    expect(summary.weeklyHours).toBe(6)
    expect(summary.authorizedHours).toBe(20)
    expect(summary.byPayer.find((p) => p.payer === 'EmblemHealth')).toEqual({ payer: 'EmblemHealth', clients: 1, hours: 2 })
    expect(summary.byPayer.find((p) => p.payer === 'Unknown payer')?.clients).toBe(1)
  })
})
