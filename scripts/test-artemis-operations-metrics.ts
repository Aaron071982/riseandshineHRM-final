/**
 * §9 regression guardrail against a real Artemis Session Reconciliation export.
 * Usage: ARTEMIS_OPS_EXPORT=/path/to/export.xlsx npm run test:artemis-operations
 */
import { readFileSync, existsSync } from 'fs'
import { ingest, DEFAULT_RATES } from '../lib/artemis/parse'
import { computeMetrics } from '../lib/artemis/metrics'
import { workbookBufferToAoa } from '../lib/artemis/excel'

const TODAY = new Date('2026-07-05')
const exportPath = process.argv[2] || process.env.ARTEMIS_OPS_EXPORT

async function main() {
  if (!exportPath || !existsSync(exportPath)) {
    console.error('Usage: ARTEMIS_OPS_EXPORT=/path/to/export.xlsx npm run test:artemis-operations')
    console.error('  or:  npm run test:artemis-operations -- /path/to/export.xlsx')
    process.exit(1)
  }

  const buf = readFileSync(exportPath)
  const aoa = await workbookBufferToAoa(buf)
  const { sessions, source, hasRealMoney } = ingest(aoa, DEFAULT_RATES)
  const past = sessions.filter((s) => !s.date || new Date(s.date) <= TODAY)
  const m = computeMetrics(sessions, DEFAULT_RATES, TODAY)

  console.log('Source:', source, '| hasRealMoney:', hasRealMoney)
  console.log('Total sessions:', sessions.length, '| Past-dated:', past.length)
  console.log('Upcoming:', m.upcoming.count, 'sessions · $' + Math.round(m.upcoming.value))
  console.log(
    'Funnel:',
    m.stages.map((s) => `${s.label} $${Math.round(s.value)}`).join(' → ')
  )
  console.log('Collection rate:', (m.collectionRate * 100).toFixed(1) + '%')
  console.log(
    'Denied leakage:',
    '$' + Math.round(m.leakage.denied.value),
    '·',
    m.leakage.denied.rows.length,
    'claims'
  )

  const checks: [string, boolean][] = [
    ['Past-dated rows = 1,167', past.length === 1167],
    ['Upcoming = 274 sessions', m.upcoming.count === 274],
    ['Upcoming ~$78,566', Math.abs(m.upcoming.value - 78566) <= 1],
    ['Scheduled $234,669', Math.abs(m.stages[0].value - 234669) <= 1],
    ['Delivered $135,470', Math.abs(m.stages[1].value - 135470) <= 1],
    ['Documented $129,046', Math.abs(m.stages[2].value - 129046) <= 1],
    ['Claimed $113,909', Math.abs(m.stages[3].value - 113909) <= 1],
    ['Collected $67,136', Math.abs(m.stages[4].value - 67136) <= 1],
    ['Collection rate 58.9%', Math.abs(m.collectionRate - 0.589) <= 0.001],
    ['Denied $2,581', Math.abs(m.leakage.denied.value - 2581) <= 1],
    ['Denied 12 claims', m.leakage.denied.rows.length === 12],
  ]

  let failed = false
  for (const [label, ok] of checks) {
    console.log(ok ? '✓' : '✗', label)
    if (!ok) failed = true
  }

  if (failed) {
    console.error('\n§9 regression FAILED — parser gating may be broken.')
    process.exit(1)
  }
  console.log('\n§9 regression PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
