import { describe, expect, it } from 'vitest'
import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from '@/lib/schedule/types'
import { findConflicts } from '@/lib/schedule/utils'
import {
  buildConstellationModel,
  pairKey,
  previewReassignment,
  resolveWeeklyTarget,
  slotsLabel,
  utilizationBand,
  type CapacityTarget,
} from './constellation'
import { layoutConstellation } from './constellationLayout'

const therapist = (id: string, name = id): ScheduleTherapist => ({
  id,
  name,
  email: null,
  role: 'RBT',
  borough: null,
  colorKey: null,
  active: true,
})
const client = (id: string, borough: string | null = 'Queens'): ScheduleClient => ({
  id,
  code: id.toUpperCase(),
  name: `Client ${id}`,
  borough,
  insurance: null,
  bcba: null,
  authorizedHoursPerWeek: null,
  active: true,
  stage: null,
})
let n = 0
const slot = (therapistId: string, clientId: string, day: ScheduleSlot['day'], start: number, end: number): ScheduleSlot => ({
  id: `s${++n}`,
  therapistId,
  clientId,
  day,
  startMin: start * 60,
  endMin: end * 60,
  status: 'CONFIRMED',
  procedureCode: '97153',
  placeOfService: '12-Home',
  note: null,
  createdBy: null,
  updatedBy: null,
})

describe('utilizationBand', () => {
  it('uses the documented thresholds', () => {
    expect(utilizationBand(19.9, 40)).toBe('under')
    expect(utilizationBand(20, 40)).toBe('healthy')
    expect(utilizationBand(35.9, 40)).toBe('healthy')
    expect(utilizationBand(36, 40)).toBe('near')
    expect(utilizationBand(40, 40)).toBe('near')
    expect(utilizationBand(40.5, 40)).toBe('over')
  })

  it('reads part-time staff against their own target', () => {
    expect(utilizationBand(17, 40)).toBe('under')
    expect(utilizationBand(17, 25)).toBe('healthy')
  })
})

describe('resolveWeeklyTarget', () => {
  it('prefers the admin target', () => {
    expect(resolveWeeklyTarget({ weeklyTargetHours: 30, preferredHoursRange: '15-25' })).toEqual({ hours: 30, source: 'ADMIN' })
  })
  it('uses the upper bound of the preferred range', () => {
    expect(resolveWeeklyTarget({ weeklyTargetHours: null, preferredHoursRange: '15-25' })).toEqual({ hours: 25, source: 'PREFERENCE' })
  })
  it('treats open-ended ranges as at least the default', () => {
    expect(resolveWeeklyTarget({ weeklyTargetHours: null, preferredHoursRange: '35+' })).toEqual({ hours: 40, source: 'PREFERENCE' })
  })
  it('falls back to 40', () => {
    expect(resolveWeeklyTarget({ weeklyTargetHours: null, preferredHoursRange: null })).toEqual({ hours: 40, source: 'DEFAULT' })
  })
})

describe('buildConstellationModel', () => {
  const slots = [
    slot('t1', 'a', 'TUE', 16, 19),
    slot('t1', 'a', 'WED', 16, 19),
    slot('t2', 'a', 'THU', 16, 18),
    slot('t2', 'b', 'TUE', 16, 18),
  ]
  const conflicts = findConflicts(slots)
  const targets = new Map<string, CapacityTarget>([['t2', { hours: 4, source: 'ADMIN', preferredHoursRange: null }]])
  const model = buildConstellationModel({
    therapists: [therapist('t1'), therapist('t2'), therapist('idle')],
    clients: [client('a'), client('b', 'Bronx')],
    slots,
    conflicts,
    targets,
  })

  it('aggregates hours per therapist and pair', () => {
    expect(model.therapists.get('t1')!.hours).toBe(6)
    expect(model.pairs.get(pairKey('t1', 'a'))!.hours).toBe(6)
    expect(model.therapists.get('idle')!.pairKeys).toHaveLength(0)
  })

  it('lists a shared client once with every therapist', () => {
    expect(model.clients.get('a')!.therapistIds.sort()).toEqual(['t1', 't2'])
    expect(model.clients.get('a')!.hours).toBe(8)
  })

  it('applies per-therapist targets', () => {
    expect(model.therapists.get('t2')!.band).toBe('near')
    expect(model.therapists.get('t1')!.band).toBe('under')
  })

  it('formats edge labels', () => {
    expect(slotsLabel(model.pairs.get(pairKey('t1', 'a'))!.slots)).toBe('Tue 4p–7p · Wed 4p–7p')
  })

  it('previews a reassignment with hours and new conflicts', () => {
    const moving = model.pairs.get(pairKey('t1', 'a'))!.slots.map((s) => s.id)
    const p = previewReassignment({ slots, movingSlotIds: moving, fromTherapistId: 't1', toTherapistId: 't2', model })
    expect(p.from.hoursAfter).toBe(0)
    expect(p.to.hoursAfter).toBe(10)
    // t2 already sees client b on Tuesday 4–6p.
    expect([...p.newConflicts.values()].flat()).toContain('Therapist double-booked at this time')
  })
})

describe('layoutConstellation', () => {
  it('is deterministic and keeps nodes from overlapping', () => {
    const nodes = ['t:1', 't:2', 'c:a', 'c:b', 'c:c'].map((id) => ({
      id,
      w: id.startsWith('t') ? 232 : 196,
      h: id.startsWith('t') ? 94 : 60,
      group: 'g',
    }))
    const links = [
      { source: 't:1', target: 'c:a' },
      { source: 't:1', target: 'c:b' },
      { source: 't:2', target: 'c:b' },
      { source: 't:2', target: 'c:c' },
    ]
    const a = layoutConstellation(nodes, links)
    const b = layoutConstellation(nodes, links)
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()])
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pa = a.positions.get(nodes[i].id)!
        const pb = a.positions.get(nodes[j].id)!
        const overlapX = pa.x < pb.x + nodes[j].w && pb.x < pa.x + nodes[i].w
        const overlapY = pa.y < pb.y + nodes[j].h && pb.y < pa.y + nodes[i].h
        expect(overlapX && overlapY).toBe(false)
      }
    }
  })
})
