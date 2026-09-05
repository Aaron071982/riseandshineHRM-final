import { describe, expect, it } from 'vitest'
import { defaultAssessmentSections } from '@/lib/crm/assessment/assessment.schema'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'

describe('parseAssessmentRecord', () => {
  it('defaults new records to AFLS', () => {
    const sections = defaultAssessmentSections()
    const parsed = parseAssessmentRecord(sections)
    expect(parsed.instruments.skillsAssessmentType).toBe('AFLS')
  })

  it('preserves ATEC as selected type when legacy ATEC text exists', () => {
    const sections = defaultAssessmentSections()
    const parsed = parseAssessmentRecord({
      ...sections,
      instruments: {
        atecAssessment: 'ATEC caregiver questionnaire completed.',
      },
    })
    expect(parsed.instruments.skillsAssessmentType).toBe('ATEC')
    expect(parsed.instruments.aflsAssessment).toBe('')
  })

  it('copies legacy AFLS text from ATEC fields into AFLS when needed', () => {
    const sections = defaultAssessmentSections()
    const parsed = parseAssessmentRecord({
      ...sections,
      instruments: {
        ...sections.instruments,
        atecAssessment: 'Client AFLS Basic Living Skills results show partial independence.',
      },
    })
    expect(parsed.instruments.skillsAssessmentType).toBe('AFLS')
    expect(parsed.instruments.aflsAssessment).toContain('AFLS')
    expect(parsed.presentLevels.afls.legacyMigratedFromAtec).toBe(true)
  })
})
