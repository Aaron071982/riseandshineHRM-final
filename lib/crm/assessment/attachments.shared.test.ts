import { describe, expect, it } from 'vitest'
import {
  MAX_ASSESSMENT_FILE_BYTES,
  inferAssessmentAttachmentKind,
  validateAssessmentFile,
} from './attachments.shared'

describe('treatment assessment attachments', () => {
  it('allows files up to 50 MB', () => {
    expect(MAX_ASSESSMENT_FILE_BYTES).toBe(50 * 1024 * 1024)
    expect(
      validateAssessmentFile({
        kind: 'PDF',
        name: 'vineland.pdf',
        size: 40 * 1024 * 1024,
        type: 'application/pdf',
      }).ok
    ).toBe(true)
  })

  it('rejects files over 50 MB', () => {
    const result = validateAssessmentFile({
      kind: 'PDF',
      name: 'huge.pdf',
      size: 50 * 1024 * 1024 + 1,
      type: 'application/pdf',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/50 MB/)
  })

  it('infers PDF vs image kinds for instrument uploads', () => {
    expect(
      inferAssessmentAttachmentKind({ name: 'fast.pdf', type: 'application/pdf' })
    ).toBe('PDF')
    expect(
      inferAssessmentAttachmentKind({ name: 'graph.png', type: 'image/png' })
    ).toBe('IMAGE')
    expect(inferAssessmentAttachmentKind({ name: 'notes.docx', type: '' })).toBe(
      null
    )
  })
})
