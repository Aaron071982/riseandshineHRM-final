import { describe, expect, it } from 'vitest'
import type { CommTemplate } from '@prisma/client'
import {
  PARENT_MILESTONES,
  TEMPLATE_MILESTONE,
  milestoneForTemplate,
  milestoneIndex,
  progressionTimelineHtml,
  progressionTimelineForTemplate,
} from './milestones'

describe('parent email milestones', () => {
  it('defines exactly 6 parent-facing milestones', () => {
    expect(PARENT_MILESTONES).toHaveLength(6)
    expect(PARENT_MILESTONES.map((m) => m.label)).toEqual([
      'Welcome',
      'Documents',
      'Insurance & Authorization',
      'Assessment',
      'Matching Your Therapist',
      'Services Begin',
    ])
  })

  it('maps templates to the expected milestone', () => {
    const cases: [CommTemplate, string][] = [
      ['WELCOME', 'welcome'],
      ['CONSENT_REQUEST', 'documents'],
      ['DOCS_NEEDED', 'documents'],
      ['BENEFITS_UPDATE', 'insurance'],
      ['AUTH_APPROVED', 'insurance'],
      ['ASSESSMENT_SCHEDULED', 'assessment'],
      ['READY_FOR_STAFFING', 'matching'],
      ['RBT_ASSIGNED', 'matching'],
      ['SCHEDULE_CONFIRMED', 'services'],
      ['MEET_AND_GREET', 'services'],
    ]
    for (const [template, expected] of cases) {
      expect(TEMPLATE_MILESTONE[template]).toBe(expected)
      expect(milestoneForTemplate(template)).toBe(expected)
    }
  })

  it('has no milestone for freeform / unmapped templates', () => {
    expect(milestoneForTemplate('MANUAL')).toBeNull()
    expect(progressionTimelineForTemplate('MANUAL')).toBe('')
  })

  it('marks earlier steps done and later muted in HTML', () => {
    const html = progressionTimelineHtml('documents')
    expect(html).toContain('Your journey with us')
    expect(html).toContain('You&rsquo;re here')
    expect(html).toContain("Welcome (done)")
    expect(html).toContain("Documents (you're here)")
    expect(html).toContain('Assessment')
    expect(html).toContain('#f2652a')
    expect(html).not.toContain('#3b82f6')
    expect(milestoneIndex('documents')).toBe(1)
  })
})
