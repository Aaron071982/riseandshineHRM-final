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
      'BILLING',
      'STAFFING',
      'CASE_COORDINATION',
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

    expect(pairs).toContain('INTAKE->BILLING')
    expect(pairs).toContain('BILLING->CLINICAL')
    expect(pairs).toContain('CLINICAL->BILLING')
    expect(pairs).toContain('BILLING->STAFFING')
    expect(pairs).toContain('STAFFING->CASE_COORDINATION')
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('merges repeated hops and marks direction', () => {
    const handoffs = buildHandoffs()
    const back = handoffs.find((h) => h.from === 'BILLING' && h.to === 'CLINICAL')
    expect(back?.kind).toBe('return')
    // Benefits → Assessment
    expect(back?.labels).toEqual(['Benefits → Assessment'])

    const forward = handoffs.find((h) => h.from === 'BILLING' && h.to === 'STAFFING')
    expect(forward?.kind).toBe('forward')
    expect(forward?.labels).toEqual(['Approved → Ready for staffing'])
  })

  it('assigns Benefits/Authorization/Approved to Billing', () => {
    const billingStages = stagesByDept().BILLING.map((s) => s.stage)
    expect(billingStages).toEqual(['BENEFITS', 'AUTHORIZATION', 'APPROVED'])
  })
})
