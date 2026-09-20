/**
 * Render side-by-side sample stubs for Prompt 5b (BCBA 1099 vs BT W-2).
 *
 *   npx tsx scripts/render-sample-stubs-html.ts
 */
import fs from 'fs'
import { buildPayStubHtml } from '../lib/payroll/payStubHtml'
import { loadPayStubLogoDataUrl } from '../lib/payroll/renderPayStubPdf'

const logoSrc = loadPayStubLogoDataUrl()
const outDir = 'public/prompt5b-shots'
fs.mkdirSync(outDir, { recursive: true })

const sharedLines = [
  {
    workDate: new Date('2026-03-03'),
    startClock: '9.00',
    endClock: '12.00',
    hours: 3,
    amount: 84,
  },
  {
    workDate: new Date('2026-03-05'),
    startClock: '13.00',
    endClock: '17.00',
    hours: 4,
    amount: 112,
  },
]

const bcba = buildPayStubHtml({
  payeeType: 'BCBA',
  legalName: 'Shazia Khan',
  entityName: 'My Lane Applied Behavior Analysis PLLC',
  payDate: new Date('2026-03-20'),
  periodStart: new Date('2026-03-02'),
  periodEnd: new Date('2026-03-15'),
  ratePerHour: 105,
  deductions: 0,
  reconciled: true,
  logoSrc,
  lineItems: [
    {
      workDate: new Date('2026-03-03'),
      startClock: '4.30',
      endClock: '6.30',
      hours: 2,
      amount: 210,
    },
    {
      workDate: new Date('2026-03-05'),
      startClock: '9.00',
      endClock: '12.00',
      hours: 3,
      amount: 315,
    },
  ],
})

const rbt = buildPayStubHtml({
  payeeType: 'RBT',
  legalName: 'Jordan Miles',
  entityName: null,
  payDate: new Date('2026-03-20'),
  periodStart: new Date('2026-03-02'),
  periodEnd: new Date('2026-03-15'),
  ratePerHour: 28,
  deductions: 0,
  reconciled: true,
  logoSrc,
  deductionRows: [
    { label: 'Federal income tax', amount: 48.5, employeePaid: true },
    { label: 'Social Security', amount: 28.3, employeePaid: true },
    { label: 'Medicare', amount: 6.62, employeePaid: true },
    { label: 'NY State tax', amount: 15.4, employeePaid: true },
    { label: 'NYC local tax', amount: 8.1, employeePaid: true },
    { label: 'NY SDI', amount: 1.2, employeePaid: true },
    { label: 'NY Paid Family Leave', amount: 2.45, employeePaid: true },
  ],
  ytd: {
    gross: 1960,
    deductions: 428.57,
    net: 1531.43,
    byLabel: [
      { label: 'Federal income tax', amount: 210 },
      { label: 'Social Security', amount: 121.52 },
      { label: 'Medicare', amount: 28.42 },
      { label: 'NY State tax', amount: 48.2 },
      { label: 'NYC local tax', amount: 20.43 },
    ],
  },
  lineItems: sharedLines,
})

fs.writeFileSync(`${outDir}/bcba-1099-stub.html`, bcba)
fs.writeFileSync(`${outDir}/rbt-w2-stub.html`, rbt)

const index = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Prompt 5b — stub variants</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;background:#f4f1ea;color:#2A2019}
  h1{font-size:20px} .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  iframe{width:100%;height:920px;border:1px solid #ccc;background:#fff}
  p{max-width:720px;line-height:1.45;color:#555}
</style></head><body>
<h1>Prompt 5b — BCBA 1099 vs BT W-2</h1>
<p>Left: contractor stub (orange 1099 band, no itemized taxes). Right: employee stub (neutral band, itemized deductions, YTD). Amounts are stored rows — no tax math in the renderer.</p>
<div class="grid">
  <div><h2>BCBA · 1099</h2><iframe src="./bcba-1099-stub.html"></iframe></div>
  <div><h2>BT / RBT · W-2</h2><iframe src="./rbt-w2-stub.html"></iframe></div>
</div>
</body></html>`
fs.writeFileSync(`${outDir}/index.html`, index)
console.log('wrote', outDir)
