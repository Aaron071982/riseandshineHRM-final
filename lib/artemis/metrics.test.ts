import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ingest, DEFAULT_RATES } from './parse'
import { computeMetrics } from './metrics'
import { workbookBufferToAoa } from './excel'

const REGRESSION_DATE = new Date('2026-07-05')
const REAL_EXPORT = process.env.ARTEMIS_OPS_EXPORT

async function loadSessionsFromExport(filePath: string) {
  const buf = readFileSync(filePath)
  const aoa = await workbookBufferToAoa(buf)
  return ingest(aoa, DEFAULT_RATES).sessions
}

describe('computeMetrics §9 regression', () => {
  it('matches acceptance checks on real Artemis export when ARTEMIS_OPS_EXPORT is set', async () => {
    if (!REAL_EXPORT || !existsSync(REAL_EXPORT)) {
      console.warn('Skipping §9 regression — set ARTEMIS_OPS_EXPORT to real xlsx path')
      return
    }
    const sessions = await loadSessionsFromExport(REAL_EXPORT)
    const past = sessions.filter((s) => !s.date || new Date(s.date) <= REGRESSION_DATE)
    const m = computeMetrics(sessions, DEFAULT_RATES, REGRESSION_DATE)

    expect(past.length).toBe(1167)
    expect(m.upcoming.count).toBe(274)
    expect(m.upcoming.value).toBeCloseTo(78566, -1)
    expect(m.stages[0].value).toBeCloseTo(234669, 0)
    expect(m.stages[1].value).toBeCloseTo(135470, 0)
    expect(m.stages[2].value).toBeCloseTo(129046, 0)
    expect(m.stages[3].value).toBeCloseTo(113909, 0)
    expect(m.stages[4].value).toBeCloseTo(67136, 0)
    expect(m.collectionRate).toBeCloseTo(0.589, 2)
    expect(m.leakage.denied.value).toBeCloseTo(2581, 0)
    expect(m.leakage.denied.rows.length).toBe(12)
  })

  it('mini fixture produces sane metrics', () => {
    const fixture = JSON.parse(
      readFileSync(join(__dirname, '__fixtures__/grouped-mini.json'), 'utf-8')
    ) as unknown[][]
    const { sessions } = ingest(fixture, DEFAULT_RATES)
    const m = computeMetrics(sessions, DEFAULT_RATES, new Date('2026-07-05'))
    expect(m.collected).toBe(50)
    expect(m.stages.length).toBe(5)
  })
})
