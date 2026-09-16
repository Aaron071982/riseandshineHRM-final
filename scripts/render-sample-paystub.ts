import fs from 'fs'
import { renderPayStubPdf } from '../lib/payroll/renderPayStubPdf'

async function main() {
  const out = 'public/prompt4-shots/bcba-paystub-rendered.pdf'
  const buf = await renderPayStubPdf({
    payeeType: 'BCBA',
    legalName: 'Shazia Khan',
    entityName: 'My Lane Applied Behavior Analysis PLLC',
    payDate: new Date('2026-03-20'),
    periodStart: new Date('2026-03-02'),
    periodEnd: new Date('2026-03-15'),
    ratePerHour: 105,
    deductions: 0,
    reconciled: true,
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
      {
        workDate: new Date('2026-03-10'),
        startClock: '13.00',
        endClock: '16.30',
        hours: 3.5,
        amount: 367.5,
      },
    ],
  })
  fs.mkdirSync('public/prompt4-shots', { recursive: true })
  fs.writeFileSync(out, buf)
  console.log('wrote', out, buf.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
