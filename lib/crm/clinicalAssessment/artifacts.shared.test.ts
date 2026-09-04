import { describe, expect, it } from 'vitest'
import {
  ALL_ASSESSMENT_ARTIFACT_TYPES,
  OPTIONAL_ASSESSMENT_ARTIFACT_TYPES,
  REQUIRED_ASSESSMENT_ARTIFACT_TYPES,
  missingAssessmentArtifactTypes,
  parseAssessmentArtifactType,
  validateClinicalAssessmentFile,
} from '@/lib/crm/clinicalAssessment/artifacts.shared'

describe('clinical assessment artifact sets', () => {
  it('requires only the initial assessment report to lock', () => {
    expect(REQUIRED_ASSESSMENT_ARTIFACT_TYPES).toEqual(['INITIAL_REPORT'])
    expect(OPTIONAL_ASSESSMENT_ARTIFACT_TYPES).toEqual([
      'VINELAND_3',
      'ATEC',
      'FAST',
      'JUSTIFICATION',
    ])
    expect(ALL_ASSESSMENT_ARTIFACT_TYPES).toHaveLength(5)
  })

  it('parses all artifact types including optional slots', () => {
    for (const type of ALL_ASSESSMENT_ARTIFACT_TYPES) {
      expect(parseAssessmentArtifactType(type)).toBe(type)
    }
  })

  it('missingAssessmentArtifactTypes ignores optional attachments', () => {
    expect(
      missingAssessmentArtifactTypes([
        { artifactType: 'VINELAND_3' },
        { artifactType: 'ATEC' },
      ])
    ).toEqual(['INITIAL_REPORT'])

    expect(
      missingAssessmentArtifactTypes([{ artifactType: 'INITIAL_REPORT' }])
    ).toEqual([])
  })

  it('accepts PDF or image for Vineland, ATEC, and FAST up to 50 MB', () => {
    for (const artifactType of ['VINELAND_3', 'ATEC', 'FAST'] as const) {
      expect(
        validateClinicalAssessmentFile({
          artifactType,
          name: `${artifactType.toLowerCase()}.pdf`,
          size: 40 * 1024 * 1024,
          type: 'application/pdf',
        }).ok
      ).toBe(true)
      expect(
        validateClinicalAssessmentFile({
          artifactType,
          name: `${artifactType.toLowerCase()}.png`,
          size: 1024,
          type: 'image/png',
        }).ok
      ).toBe(true)
    }
  })

  it('rejects clinical assessment files over 50 MB', () => {
    const result = validateClinicalAssessmentFile({
      artifactType: 'INITIAL_REPORT',
      name: 'report.pdf',
      size: 50 * 1024 * 1024 + 1,
      type: 'application/pdf',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/50 MB/)
  })
})
