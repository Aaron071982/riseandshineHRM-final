import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIAGNOSIS,
  assessmentDetailsHasSafetyFlags,
  groupHasContent,
  normalizeAssessmentDetailsInput,
} from '@/lib/crm/clinicalAssessment/details.shared'

describe('normalizeAssessmentDetailsInput', () => {
  it('accepts partial input and trims strings', () => {
    const out = normalizeAssessmentDetailsInput({
      patientName: '  Alex  ',
      diagnosis: '',
      hrs97153: '20',
    })
    expect(out.patientName).toBe('Alex')
    expect(out.diagnosis).toBeNull()
    expect(out.hrs97153).toBe('20')
    expect(out.locations).toEqual([])
  })

  it('parses dates and checkbox arrays', () => {
    const out = normalizeAssessmentDetailsInput({
      dob: '2020-01-15',
      locations: ['Home', 'School'],
      riskFactors: ['SIB', 'Elopement'],
      goalAreas: ['Communication'],
    })
    expect(out.dob?.toISOString().slice(0, 10)).toBe('2020-01-15')
    expect(out.locations).toEqual(['Home', 'School'])
    expect(out.riskFactors).toEqual(['SIB', 'Elopement'])
    expect(out.goalAreas).toEqual(['Communication'])
  })
})

describe('assessmentDetailsHasSafetyFlags', () => {
  it('is false for empty snapshot', () => {
    expect(assessmentDetailsHasSafetyFlags(null)).toBe(false)
  })

  it('detects risk factors', () => {
    const base = normalizeAssessmentDetailsInput({})
    expect(
      assessmentDetailsHasSafetyFlags({
        ...base,
        id: '1',
        assessmentId: 'a1',
        updatedAt: new Date(),
      })
    ).toBe(false)
    expect(
      assessmentDetailsHasSafetyFlags({
        ...base,
        id: '1',
        assessmentId: 'a1',
        updatedAt: new Date(),
        riskFactors: ['SIB'],
      })
    ).toBe(true)
  })
})

describe('groupHasContent', () => {
  it('returns false for empty groups', () => {
    const empty = {
      ...normalizeAssessmentDetailsInput({ diagnosis: DEFAULT_DIAGNOSIS }),
      id: '1',
      assessmentId: 'a1',
      updatedAt: new Date(),
    }
    expect(groupHasContent('signOff', empty)).toBe(false)
    expect(groupHasContent('clinical', empty)).toBe(false)
  })
})
