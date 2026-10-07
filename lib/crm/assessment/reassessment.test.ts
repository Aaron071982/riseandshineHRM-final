import { describe, expect, it } from 'vitest'
import {
  defaultAssessmentSections,
  goalRowColumnASchema,
  goalRowColumnBSchema,
  reassessmentSchema,
  type AssessmentSectionData,
} from '@/lib/crm/assessment/assessment.schema'
import { RESPONSE_TO_TREATMENT_DEFAULT } from '@/lib/crm/assessment/boilerplate'
import {
  buildReassessmentClone,
  goalProgressSummary,
  reassessmentIssues,
  sameValue,
} from '@/lib/crm/assessment/reassessment'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'

function initialWithGoals(): AssessmentSectionData {
  const s = defaultAssessmentSections()
  s.summary.reportDate = '2026-03-02'
  s.summary.diagnosis = 'ASD Level 2'
  s.treatmentRequest.hrs97153Initial = '20'
  s.treatmentRequest.hrs97156 = '1'
  s.locationSchedule.primaryLocations.home = true
  s.presentLevels.vineland = { date: '2026-02-20', interpretation: 'ABC 68' }
  s.goals.communication.rows = [
    goalRowColumnASchema.parse({
      id: 'g1',
      goalName: 'Mand for items',
      baseline: '10%',
      previousAssessmentScore: 'n/a',
      currentPerformance: '40%',
      masteryCriteria: '80% across 3 sessions',
      targetMasteryDate: '09/2026',
    }),
  ]
  s.parentTraining.summaryGoals = [
    goalRowColumnBSchema.parse({ id: 'p1', goal: 'Use first-then', currentPerformance: '2/5' }),
  ]
  s.signatures.bcba = { name: 'Dana BCBA', credentials: 'BCBA', signatureData: 'data:image/png;base64,xx', signatureTypedName: 'Dana', date: '2026-03-03' }
  return s
}

describe('buildReassessmentClone', () => {
  it('rolls goal performance forward and resets per-period fields', () => {
    const prev = initialWithGoals()
    const clone = buildReassessmentClone(prev, { previousWasReassessment: false, previousReportDate: '2026-03-02' })

    const row = clone.goals.communication.rows[0]
    expect(row.id).toBe('g1')
    expect(row.goalName).toBe('Mand for items')
    expect(row.previousAssessmentScore).toBe('40%')
    expect(row.currentPerformance).toBe('')
    expect(row.status).toBe('')

    const pRow = clone.parentTraining.summaryGoals[0]
    expect(pRow.previousAssessmentPerformance).toBe('2/5')
    expect(pRow.currentPerformance).toBe('')

    expect(clone.summary.reportDate).toBe('')
    expect(clone.summary.diagnosis).toBe('ASD Level 2')
    expect(clone.signatures.bcba).toMatchObject({ name: 'Dana BCBA', signatureData: '', signatureTypedName: '', date: '' })
    expect(clone.transitionPlan.reviewedThisPeriod).toBe(false)
  })

  it('never mutates the predecessor', () => {
    const prev = initialWithGoals()
    const snapshot = structuredClone(prev)
    buildReassessmentClone(prev, { previousWasReassessment: false, previousReportDate: '2026-03-02' })
    expect(prev).toEqual(snapshot)
  })

  it('clears the initial-assessment response-to-treatment placeholder only', () => {
    const prev = initialWithGoals()
    expect(prev.responseToTx.narrative).toBe(RESPONSE_TO_TREATMENT_DEFAULT)
    const clone = buildReassessmentClone(prev, { previousWasReassessment: false, previousReportDate: '' })
    expect(clone.responseToTx.narrative).toBe('')

    prev.responseToTx.narrative = 'Client made steady gains in manding.'
    const clone2 = buildReassessmentClone(prev, { previousWasReassessment: false, previousReportDate: '' })
    expect(clone2.responseToTx.narrative).toBe('Client made steady gains in manding.')
  })

  it('keeps terminal goal outcomes and their dates/rationales', () => {
    const prev = initialWithGoals()
    prev.goals.communication.rows[0] = { ...prev.goals.communication.rows[0], status: 'MASTERED', dateMastered: '2026-05-01' }
    prev.parentTraining.summaryGoals[0] = { ...prev.parentTraining.summaryGoals[0], status: 'MODIFIED', rationale: 'Split into steps' }
    const clone = buildReassessmentClone(prev, { previousWasReassessment: true, previousReportDate: '' })
    expect(clone.goals.communication.rows[0]).toMatchObject({ status: 'MASTERED', dateMastered: '2026-05-01' })
    expect(clone.parentTraining.summaryGoals[0]).toMatchObject({ status: '', rationale: '' })
  })

  it('prefills the reassessment section from an initial assessment', () => {
    const clone = buildReassessmentClone(initialWithGoals(), { previousWasReassessment: false, previousReportDate: '2026-03-02' })
    const r = clone.reassessment
    expect(r.reportingPeriod.periodStart).toBe('2026-03-02')
    expect(r.caregiverTraining.requiredMinimum).toBe(6)
    expect(r.instrumentComparison.map((x) => x.instrument)).toEqual(['Vineland-3', 'AFLS', 'FAST', 'PDDBI / SRS-2'])
    expect(r.instrumentComparison[0]).toMatchObject({ priorDate: '2026-02-20', priorResult: 'ABC 68', currentDate: '' })
    const u97153 = r.unitsRequested.find((u) => u.code === '97153')!
    expect(u97153.previousRequest).toBe('20')
    expect(u97153.unitsRequested).toBe('')
    expect(u97153.locations.home).toBe(true)
  })

  it('chains from a previous reassessment: current becomes prior', () => {
    const prev = initialWithGoals()
    prev.reassessment = reassessmentSchema.parse({
      reportingPeriod: { periodStart: '2026-03-02', periodEnd: '2026-09-01', authorizationNumber: 'AUTH-1' },
      caregiverTraining: { requiredMinimum: 8, sessionsDelivered: 9 },
      instrumentComparison: [
        { id: 'i1', instrument: 'Vineland-3', priorDate: '2026-02-20', priorResult: 'ABC 68', currentDate: '2026-08-15', currentResult: 'ABC 74' },
      ],
      unitsRequested: [{ code: '97153', unitsRequested: '25', locations: { clinic: true } }],
    })
    const clone = buildReassessmentClone(prev, { previousWasReassessment: true, previousReportDate: '' })
    const r = clone.reassessment
    expect(r.reportingPeriod).toMatchObject({ periodStart: '2026-09-01', periodEnd: '', authorizationNumber: '' })
    expect(r.caregiverTraining).toMatchObject({ requiredMinimum: 8, sessionsDelivered: null })
    expect(r.instrumentComparison[0]).toMatchObject({ priorDate: '2026-08-15', priorResult: 'ABC 74', currentResult: '' })
    const u = r.unitsRequested.find((x) => x.code === '97153')!
    expect(u).toMatchObject({ previousRequest: '25', unitsRequested: '' })
    expect(u.locations.clinic).toBe(true)
  })
})

describe('reassessmentIssues', () => {
  function readyClone() {
    const c = buildReassessmentClone(initialWithGoals(), { previousWasReassessment: false, previousReportDate: '2026-03-02' })
    c.reassessment.reportingPeriod.periodEnd = '2026-09-01'
    c.reassessment.caregiverTraining.sessionsDelivered = 7
    c.goals.communication.rows[0].status = 'IN_PROGRESS'
    c.parentTraining.summaryGoals[0].status = 'IN_PROGRESS'
    c.responseToTx.narrative = 'Progress noted.'
    c.interventions.narrative = 'Updated interventions.'
    c.goals.behaviorReduction.analysisNarrative = 'Behavior decreased 30%.'
    c.transitionPlan.reviewedThisPeriod = true
    return c
  }

  it('passes when everything required is filled', () => {
    expect(reassessmentIssues(readyClone())).toEqual([])
  })

  it('requires a rationale for Modified / Discontinued goals', () => {
    const c = readyClone()
    c.goals.communication.rows[0].status = 'DISCONTINUED'
    expect(reassessmentIssues(c).map((i) => i.message).join(' ')).toMatch(/Mand for items.*Discontinued without a rationale/)
    c.goals.communication.rows[0].rationale = 'No longer clinically relevant'
    expect(reassessmentIssues(c)).toEqual([])
  })

  it('requires explanation and mitigation below the caregiver-training minimum', () => {
    const c = readyClone()
    c.reassessment.caregiverTraining.sessionsDelivered = 3
    expect(reassessmentIssues(c)).toHaveLength(1)
    c.reassessment.caregiverTraining.belowMinimumExplanation = 'Family illness'
    c.reassessment.caregiverTraining.mitigationPlan = 'Telehealth sessions twice monthly'
    expect(reassessmentIssues(c)).toEqual([])
  })

  it('flags leftover initial-assessment wording and unreviewed transition criteria', () => {
    const c = buildReassessmentClone(initialWithGoals(), { previousWasReassessment: false, previousReportDate: '' })
    const messages = reassessmentIssues(c).map((i) => i.message).join(' | ')
    expect(messages).toMatch(/97155 interventions still contains initial-assessment wording/)
    expect(messages).toMatch(/Transition \/ discharge criteria have not been marked/)
    expect(messages).toMatch(/2 goals have no status/)
  })
})

describe('goalProgressSummary', () => {
  it('counts statuses across goal and parent-training tables', () => {
    const c = buildReassessmentClone(initialWithGoals(), { previousWasReassessment: false, previousReportDate: '' })
    c.goals.communication.rows[0].status = 'MASTERED'
    const s = goalProgressSummary(c)
    expect(s.total).toBe(2)
    expect(s.counts.MASTERED).toBe(1)
    expect(s.unset).toBe(1)
    expect(s.lists.MASTERED[0]).toMatchObject({ table: 'Communication', name: 'Mand for items' })
  })
})

describe('schema compatibility', () => {
  it('parses existing records without reassessment fields', () => {
    const legacy = {
      ...defaultAssessmentSections(),
      goals: { communication: { rows: [{ id: 'x', goalName: 'Old goal' }] } },
      reassessment: undefined,
    }
    const parsed = parseAssessmentRecord(legacy)
    expect(parsed.goals.communication.rows[0]).toMatchObject({ goalName: 'Old goal', status: '', rationale: '' })
    expect(parsed.reassessment.caregiverTraining.requiredMinimum).toBe(6)
    expect(parsed.transitionPlan.reviewedThisPeriod).toBe(false)
  })

  it('sameValue ignores key order', () => {
    expect(sameValue({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(true)
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false)
  })
})
