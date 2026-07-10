import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { findArtemisHeader, parseArtemis, ingest, DEFAULT_RATES } from './parse'

const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/grouped-mini.json'), 'utf-8')
) as unknown[][]

describe('parseArtemis', () => {
  it('finds Artemis header row', () => {
    expect(findArtemisHeader(fixture)).toBe(1)
  })

  it('forward-fills grouped Status and Claim Status', () => {
    const hi = findArtemisHeader(fixture)
    const sessions = parseArtemis(fixture, hi)
    // Row 3 (index 2 in body) should inherit Completed + Paid from row above
    expect(sessions[1].sessionStatus).toBe('Completed')
    expect(sessions[1].claimStatus).toBe('Paid')
    // Row 5 should inherit Ready to Bill + Submitted
    expect(sessions[3].sessionStatus).toBe('Ready to Bill')
    expect(sessions[3].claimStatus).toBe('Submitted')
  })

  it('clears claim status when no claim number', () => {
    const hi = findArtemisHeader(fixture)
    const sessions = parseArtemis(fixture, hi)
    // C002 first row has no claim number — claim status should be empty
    expect(sessions[2].claimNo).toBe('')
    expect(sessions[2].claimStatus).toBe('')
  })

  it('de-duplicates paid amount per claim (one paid row per claim)', () => {
    const hi = findArtemisHeader(fixture)
    const sessions = parseArtemis(fixture, hi)
    const clm100 = sessions.filter((s) => s.claimNo === 'CLM-100')
    expect(clm100).toHaveLength(2)
    const paidTotal = clm100.reduce((acc, s) => acc + s.paidAlloc, 0)
    expect(paidTotal).toBe(50) // only first row gets paidAlloc
    expect(clm100[0].paidAlloc).toBe(50)
    expect(clm100[1].paidAlloc).toBe(0)
  })
})

describe('ingest', () => {
  it('detects Artemis format and returns sessions', () => {
    const result = ingest(fixture, DEFAULT_RATES)
    expect(result.source).toBe('Artemis Session Reconciliation')
    expect(result.hasRealMoney).toBe(true)
    expect(result.sessions.length).toBe(4)
  })
})
