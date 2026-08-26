import { describe, expect, it } from 'vitest'
import {
  filterTreeToWhere,
  parseFilterTree,
  QUERY_FILTER_FIELDS,
} from './queryBuilder'
import { authExpiryBand, daysUntilExpiry } from './authBands'
import { REPORT_CATALOG } from './reportCatalog'

describe('operations queryBuilder whitelist', () => {
  it('rejects unknown fields', () => {
    const parsed = parseFilterTree({
      op: 'AND',
      clauses: [{ field: 'socialSecurityNumber', op: 'eq', value: 'x' }],
    })
    expect(parsed).toMatchObject({ code: 'UNKNOWN_FIELD' })
  })

  it('rejects language as not tracked', () => {
    const parsed = parseFilterTree({
      op: 'AND',
      clauses: [{ field: 'language', op: 'eq', value: 'Spanish' }],
    })
    expect(parsed).toMatchObject({ code: 'NOT_TRACKED', field: 'language' })
  })

  it('translates whitelisted stage filter', () => {
    const res = filterTreeToWhere({
      op: 'AND',
      clauses: [{ field: 'stage', op: 'eq', value: 'ASSESSMENT' }],
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.where).toMatchObject({ stage: 'ASSESSMENT' })
  })

  it('exposes a stable whitelist', () => {
    expect(QUERY_FILTER_FIELDS).toContain('stage')
    expect(QUERY_FILTER_FIELDS).not.toContain('parentEmail')
  })
})

describe('auth band engine', () => {
  it('maps remaining days into bands', () => {
    expect(authExpiryBand(-1)).toBe('expired')
    expect(authExpiryBand(0)).toBe(0)
    expect(authExpiryBand(5)).toBe(7)
    expect(authExpiryBand(20)).toBe(30)
    expect(authExpiryBand(50)).toBe('beyond')
  })

  it('computes days until expiry', () => {
    const inTen = new Date()
    inTen.setDate(inTen.getDate() + 10)
    expect(daysUntilExpiry(inTen)).toBeGreaterThanOrEqual(9)
    expect(daysUntilExpiry(inTen)).toBeLessThanOrEqual(11)
  })
})

describe('report catalog', () => {
  it('ships all 10 standard reports', () => {
    expect(REPORT_CATALOG).toHaveLength(10)
    expect(REPORT_CATALOG.map((r) => r.key)).toEqual(
      expect.arrayContaining([
        'pipeline-health',
        'unstaffed-active',
        'missing-documents',
        'authorizations-expiring',
        'reassessments-due',
        'under-approved',
        'department-queue',
        'cc-load',
        'email-activity',
        'new-intakes',
      ])
    )
  })
})
