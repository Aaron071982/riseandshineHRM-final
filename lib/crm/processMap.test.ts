import { describe, expect, it } from 'vitest'
import {
  buildHandoffs,
  PROCESS_DEPT_ORDER,
  stagesByDept,
} from './processMapModel'
import { LINEAR_STAGE_ORDER, STAGE_DEFAULT_OWNER_DEPT } from './stages'

describe('lib/crm/processMap Phase 11', () => {
  it('gives every department a node slot in pipeline order', () => {
    expect(PROCESS_DEPT_ORDER).toEqual([
      'INTAKE',
      'CLINICAL',
      'AUTHORIZATION',
      'STAFFING',
      'CASE_COORDINATION',
      'BILLING',
    ])
  })

  it('assigns every linear stage to its default owner, TREATMENT_PLAN excluded', () => {
    const byDept = stagesByDept()
    const assigned = Object.values(byDept).flatMap((s) => s.map((x) => x.stage))
    expect(assigned.sort()).toEqual([...LINEAR_STAGE_ORDER].sort())
    expect(assigned).not.toContain('TREATMENT_PLAN')
    for (const [dept, stages] of Object.entries(byDept)) {
      for (const s of stages) {
        expect(STAGE_DEFAULT_OWNER_DEPT[s.stage]).toBe(dept)
      }
    }
  })

  it('derives handoffs from stage owner transitions', () => {
    const handoffs = buildHandoffs()
    const pairs = handoffs.map((h) => `${h.from}->${h.to}`)

    expect(pairs).toContain('INTAKE->CASE_COORDINATION')
    expect(pairs).toContain('CASE_COORDINATION->CLINICAL')
    expect(pairs).toContain('CLINICAL->AUTHORIZATION')
    expect(pairs).toContain('AUTHORIZATION->STAFFING')
    expect(pairs).toContain('STAFFING->CASE_COORDINATION')
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('merges repeated hops and marks direction', () => {
    const handoffs = buildHandoffs()
    const back = handoffs.find(
      (h) => h.from === 'CASE_COORDINATION' && h.to === 'CLINICAL'
    )
    expect(back?.kind).toBe('return')
    // Benefits → Assessment and Pre-start → Active share this hop.
    expect(back?.labels.length).toBe(2)

    const forward = handoffs.find(
      (h) => h.from === 'AUTHORIZATION' && h.to === 'STAFFING'
    )
    expect(forward?.kind).toBe('forward')
    expect(forward?.labels).toEqual(['Approved → Ready for staffing'])
  })

  it('keeps Billing connected even though it owns no pipeline stage', () => {
    expect(stagesByDept().BILLING).toEqual([])
    const billingEdge = buildHandoffs().find((h) => h.to === 'BILLING')
    expect(billingEdge?.from).toBe('CLINICAL')
    expect(billingEdge?.kind).toBe('implied')
  })
})
