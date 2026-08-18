import { describe, expect, it } from 'vitest'
import { canAdvance, nextStage, STAGE_GROUP } from './stages'

describe('lib/crm/stages Phase 6', () => {
  it('skips TREATMENT_PLAN in linear advance', () => {
    expect(nextStage('ASSESSMENT')).toBe('AUTHORIZATION')
    expect(nextStage('TREATMENT_PLAN')).toBe('AUTHORIZATION')
  })

  it('puts Benefits in Intake group', () => {
    expect(STAGE_GROUP.BENEFITS).toBe('INTAKE')
  })

  it('gates ACTIVE on treatment plan COMPLETE', () => {
    const blocked = canAdvance(
      { stage: 'PRE_START', treatmentPlanStatus: 'IN_PROGRESS' },
      [
        {
          key: 'meet_and_greet_done',
          stage: 'PRE_START',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
        {
          key: 'start_date_set',
          stage: 'PRE_START',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
      ]
    )
    expect(blocked.ok).toBe(false)
    expect(blocked.blockedBy).toContain('treatment_plan_complete')

    const ok = canAdvance(
      { stage: 'PRE_START', treatmentPlanStatus: 'COMPLETE' },
      [
        {
          key: 'meet_and_greet_done',
          stage: 'PRE_START',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
        {
          key: 'start_date_set',
          stage: 'PRE_START',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
      ]
    )
    expect(ok.ok).toBe(true)
  })

  it('does not require treatment plan for staffing stages', () => {
    const gate = canAdvance(
      { stage: 'READY_FOR_STAFFING', treatmentPlanStatus: 'NOT_STARTED' },
      [
        {
          key: 'staffing_packet_ready',
          stage: 'READY_FOR_STAFFING',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
        {
          key: 'preferred_schedule_captured',
          stage: 'READY_FOR_STAFFING',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
      ]
    )
    expect(gate.ok).toBe(true)
  })
})
