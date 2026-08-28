import { describe, expect, it } from 'vitest'
import {
  computeStageAdvanceWarnings,
  crossesAssessmentAuthPoint,
  isAssessmentPaOnFile,
  warningsAcknowledged,
} from './stageWarnings'

describe('isAssessmentPaOnFile', () => {
  it('requires APPROVED ASSESSMENT auth', () => {
    expect(
      isAssessmentPaOnFile([
        { authType: 'ASSESSMENT', status: 'PENDING', deletedAt: null },
      ])
    ).toBe(false)
    expect(
      isAssessmentPaOnFile([
        { authType: 'ASSESSMENT', status: 'APPROVED', deletedAt: null },
      ])
    ).toBe(true)
  })
})

describe('computeStageAdvanceWarnings', () => {
  it('warns on PA when auth required and crossing into assessment', () => {
    const warnings = computeStageAdvanceWarnings({
      fromStage: 'BENEFITS',
      toStage: 'ASSESSMENT',
      authRequired: true,
      treatmentPlanStatus: 'COMPLETE',
      authorizations: [],
    })
    expect(warnings.map((w) => w.code)).toEqual(['pa_not_on_file'])
  })

  it('skips PA warning when auth not required', () => {
    const warnings = computeStageAdvanceWarnings({
      fromStage: 'BENEFITS',
      toStage: 'ASSESSMENT',
      authRequired: false,
      treatmentPlanStatus: 'COMPLETE',
      authorizations: [],
    })
    expect(warnings).toEqual([])
  })

  it('warns on treatment plan before Active', () => {
    const warnings = computeStageAdvanceWarnings({
      fromStage: 'PRE_START',
      toStage: 'ACTIVE',
      authRequired: true,
      treatmentPlanStatus: 'IN_PROGRESS',
      authorizations: [
        { authType: 'ASSESSMENT', status: 'APPROVED', deletedAt: null },
      ],
    })
    expect(warnings.map((w) => w.code)).toEqual(['treatment_plan_incomplete'])
  })
})

describe('crossesAssessmentAuthPoint', () => {
  it('detects BENEFITS → ASSESSMENT', () => {
    expect(crossesAssessmentAuthPoint('BENEFITS', 'ASSESSMENT')).toBe(true)
    expect(crossesAssessmentAuthPoint('ASSESSMENT', 'AUTHORIZATION')).toBe(false)
  })
})

describe('warningsAcknowledged', () => {
  it('requires all warning codes in overrides', () => {
    const warnings = computeStageAdvanceWarnings({
      fromStage: 'BENEFITS',
      toStage: 'ACTIVE',
      authRequired: true,
      treatmentPlanStatus: 'NOT_STARTED',
      authorizations: [],
    })
    expect(warningsAcknowledged(warnings, ['pa_not_on_file'])).toBe(false)
    expect(
      warningsAcknowledged(warnings, [
        'pa_not_on_file',
        'treatment_plan_incomplete',
      ])
    ).toBe(true)
  })
})
