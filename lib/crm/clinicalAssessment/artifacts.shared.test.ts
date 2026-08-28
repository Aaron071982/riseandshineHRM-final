import { describe, expect, it } from 'vitest'
import {
  ALL_ASSESSMENT_ARTIFACT_TYPES,
  OPTIONAL_ASSESSMENT_ARTIFACT_TYPES,
  REQUIRED_ASSESSMENT_ARTIFACT_TYPES,
  missingAssessmentArtifactTypes,
  parseAssessmentArtifactType,
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
})
