import { describe, expect, it } from 'vitest'
import {
  buildPayStubHtml,
  payStubDownloadFilename,
} from '@/lib/payroll/payStubHtml'

describe('payStubHtml', () => {
  it('names download file from legal name + pay date', () => {
    expect(
      payStubDownloadFilename('Shazia Khan', new Date('2026-03-20T12:00:00Z'))
    ).toBe('Shazia Khan Pay Statement 2026-03-20.pdf')
  })

  it('includes 1099 band for BCBA and reconciliation warning', () => {
    const html = buildPayStubHtml({
      payeeType: 'BCBA',
      legalName: 'Shazia Khan',
      entityName: 'My Lane ABA PLLC',
      payDate: new Date('2026-03-20'),
      periodStart: new Date('2026-03-02'),
      periodEnd: new Date('2026-03-15'),
      ratePerHour: 105,
      deductions: 0,
      reconciled: false,
      logoSrc: 'data:image/png;base64,xx',
      lineItems: [
        {
          workDate: new Date('2026-03-03'),
          startClock: '4.30',
          endClock: '6.30',
          hours: 2,
          amount: 210,
        },
      ],
    })
    expect(html).toContain('Contractor payment — 1099')
    expect(html).toContain('PAY STATEMENT')
    expect(html).toContain('My Lane ABA PLLC')
    expect(html).toContain("don't match line items")
    expect(html).toContain('$210.00')
    expect(html).toContain('$0.00')
  })

  it('uses employee framing for RBT (no 1099 band)', () => {
    const html = buildPayStubHtml({
      payeeType: 'RBT',
      legalName: 'Jordan Miles',
      entityName: null,
      payDate: new Date('2026-03-20'),
      periodStart: new Date('2026-03-02'),
      periodEnd: new Date('2026-03-15'),
      ratePerHour: 28,
      deductions: 0,
      reconciled: true,
      logoSrc: 'data:image/png;base64,xx',
      lineItems: [
        {
          workDate: new Date('2026-03-04'),
          startClock: '9.00',
          endClock: '12.00',
          hours: 3,
          amount: 84,
        },
      ],
    })
    expect(html).toContain('Employee payment')
    expect(html).not.toContain('1099')
  })
})
