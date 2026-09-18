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
  ],
  ytd: { gross: 1960, deductions: 428, net: 1532 },
  lineItems: sharedLines,
})

fs.writeFileSync(`${outDir}/bcba-1099-stub.html`, bcba)
fs.writeFileSync(`${outDir}/rbt-w2-stub.html`, rbt)
console.log('wrote', outDir)
