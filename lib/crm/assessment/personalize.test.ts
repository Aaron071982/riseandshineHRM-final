import { describe, expect, it } from 'vitest'
import {
  personalizeAssessmentValue,
  personalizeClientReferences,
} from '@/lib/crm/assessment/personalize'

describe('personalizeClientReferences', () => {
  it('replaces Client / the client with the child name', () => {
    const name = 'Jordan Lee'
    expect(personalizeClientReferences("based on Client's response", name)).toBe(
      "based on Jordan Lee's response"
    )
    expect(
      personalizeClientReferences("individualized to the client's needs", name)
    ).toBe('individualized to Jordan Lee\'s needs')
    expect(personalizeClientReferences('If the Client has a history', name)).toBe(
      'If Jordan Lee has a history'
    )
    expect(personalizeClientReferences('When Client can show mastery', name)).toBe(
      'When Jordan Lee can show mastery'
    )
    expect(
      personalizeClientReferences("multiple sets of a Client's guardians", name)
    ).toBe("multiple sets of Jordan Lee's guardians")
    expect(
      personalizeClientReferences('maximize treatment outcome for the individual client.', name)
    ).toBe('maximize treatment outcome for Jordan Lee.')
  })

  it('does not alter Clinical / clinical words', () => {
    expect(
      personalizeClientReferences('Clinical Rationale: Client needs support', 'Ava')
    ).toBe('Clinical Rationale: Ava needs support')
  })

  it('no-ops without a name', () => {
    expect(personalizeClientReferences("Client's plan", '  ')).toBe("Client's plan")
  })

  it('walks nested assessment section values', () => {
    const out = personalizeAssessmentValue(
      {
        narrative: "Client's parents participated",
        rows: [{ criteria: 'When Client has met mastery' }],
      },
      'Sam'
    )
    expect(out).toEqual({
      narrative: "Sam's parents participated",
      rows: [{ criteria: 'When Sam has met mastery' }],
    })
  })
})
