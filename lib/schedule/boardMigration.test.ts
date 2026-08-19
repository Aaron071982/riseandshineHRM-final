import { describe, expect, it } from 'vitest'
import {
  assignmentFingerprint,
  isArtemisMirrorNote,
  matchTherapistToRbt,
  planBoardSlot,
  summarizePlan,
  type BoardSlot,
} from './boardMigration'

const slot = (over: Partial<BoardSlot> = {}): BoardSlot => ({
  id: 'slot-1',
  therapistId: 'th-1',
  clientId: 'cl-1',
  day: 'MON',
  startMin: 9 * 60,
  endMin: 12 * 60,
  placeOfService: '12-Home',
  note: null,
  ...over,
})

const therapist = {
  id: 'th-1',
  name: 'Ada Lovelace',
  email: 'ada@rise.test',
}

const rbts = [
  { id: 'rbt-ada', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@rise.test' },
  { id: 'rbt-other', firstName: 'Grace', lastName: 'Hopper', email: 'grace@rise.test' },
]

const clients = [
  { id: 'sc-1', firstName: 'Maya', lastName: 'Chen', pipelineStatus: 'LIVE' },
  { id: 'sc-2', firstName: 'Stopped', lastName: 'Kid', pipelineStatus: 'DISCHARGED' },
]

describe('board migration classification', () => {
  it('treats Artemis import notes as mirrors', () => {
    expect(isArtemisMirrorNote('Artemis import')).toBe(true)
    expect(isArtemisMirrorNote('  ARTEMIS IMPORT ')).toBe(true)
    expect(isArtemisMirrorNote(null)).toBe(false)
  })

  it('matches therapist by email then unique name', () => {
    expect(matchTherapistToRbt(therapist, rbts)).toEqual({ id: 'rbt-ada', how: 'email' })
    expect(
      matchTherapistToRbt({ id: 'x', name: 'Grace Hopper', email: null }, rbts)
    ).toEqual({ id: 'rbt-other', how: 'name' })
    expect(
      matchTherapistToRbt({ id: 'x', name: 'Nobody', email: null }, rbts)
    ).toBeNull()
  })

  it('skips Artemis mirrors without inserting', () => {
    const row = planBoardSlot({
      slot: slot({ note: 'Artemis import' }),
      therapist,
      client: { id: 'cl-1', name: 'Maya Chen', borough: null },
      rbts,
      serviceClients: clients,
      existingFingerprints: new Set(),
      alreadyMigratedSlotIds: new Set(),
      activeByClientKey: new Map(),
    })
    expect(row.disposition).toBe('mirror')
  })

  it('skips slots already represented by a live assignment', () => {
    const fp = assignmentFingerprint({
      rbtProfileId: 'rbt-ada',
      clientName: 'Maya Chen',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    })
    const row = planBoardSlot({
      slot: slot(),
      therapist,
      client: { id: 'cl-1', name: 'Maya Chen', borough: null },
      rbts,
      serviceClients: clients,
      existingFingerprints: new Set([fp]),
      alreadyMigratedSlotIds: new Set(),
      activeByClientKey: new Map(),
    })
    expect(row.disposition).toBe('already_represented')
  })

  it('flags unresolved RBT and does not guess', () => {
    const row = planBoardSlot({
      slot: slot(),
      therapist: { id: 'th-x', name: 'Unknown Person', email: null },
      client: { id: 'cl-1', name: 'Maya Chen', borough: null },
      rbts,
      serviceClients: clients,
      existingFingerprints: new Set(),
      alreadyMigratedSlotIds: new Set(),
      activeByClientKey: new Map(),
    })
    expect(row.disposition).toBe('unresolved_rbt')
    expect(row.rbtProfileId).toBeNull()
  })

  it('migrates board-only slots as provisional and flags therapist-switch conflicts', () => {
    const row = planBoardSlot({
      slot: slot(),
      therapist,
      client: { id: 'cl-1', name: 'Maya Chen', borough: null },
      rbts,
      serviceClients: clients,
      existingFingerprints: new Set(),
      alreadyMigratedSlotIds: new Set(),
      activeByClientKey: new Map([
        [
          'id:sc-1',
          [
            {
              id: 'asg-old',
              rbtProfileId: 'rbt-other',
              clientName: 'Maya Chen',
              dayOfWeek: 3,
              startTime: '10:00',
              endTime: '13:00',
              serviceClientId: 'sc-1',
              isActive: true,
            },
          ],
        ],
      ]),
    })
    expect(row.disposition).toBe('migrate')
    expect(row.rbtProfileId).toBe('rbt-ada')
    expect(row.serviceClientId).toBe('sc-1')
    expect(row.serviceClientLive).toBe(true)
    expect(row.conflictAssignmentIds).toEqual(['asg-old'])
  })

  it('summarizes dispositions', () => {
    expect(
      summarizePlan([
        { disposition: 'mirror' } as never,
        { disposition: 'migrate' } as never,
        { disposition: 'migrate' } as never,
      ])
    ).toMatchObject({ mirror: 1, migrate: 2, unresolved_rbt: 0 })
  })
})
