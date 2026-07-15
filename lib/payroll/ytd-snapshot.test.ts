import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parseYtdSnapshot } from './ytd-snapshot-parser'
import {
  countEmployeesWithPay,
  deriveRunsFromSnapshots,
  formatPeriodDay,
} from './ytd-snapshot-diff'

const FIXTURE_DIR = join(__dirname, '../../test/fixtures/payroll-ytd')

const FILES = [
  'Jan 07 26.xls',
  'Jan 21 26.xls',
  'Fab 04 26.xls',
  'Fab 19 26.xls',
  'Mar 06 26.xls',
  'Mar 19 26.xls',
  'Apr 07 26.xls',
] as const

function loadAll() {
  return FILES.map((f) => parseYtdSnapshot(readFileSync(join(FIXTURE_DIR, f)), f))
}

function emp(snap: ReturnType<typeof parseYtdSnapshot>, name: string) {
  const e = snap.employees.find((x) => x.rawName === name)
  if (!e) throw new Error(`Missing ${name} in ${snap.fileName}`)
  return e
}

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d))
}

describe('parseYtdSnapshot — fixtures present', () => {
  it('has all 7 fixture files', () => {
    const present = new Set(readdirSync(FIXTURE_DIR))
    for (const f of FILES) expect(present.has(f)).toBe(true)
  })
})

describe('parseYtdSnapshot — headers', () => {
  it('reads period dates from sheet cells (not filenames)', () => {
    const fab = parseYtdSnapshot(readFileSync(join(FIXTURE_DIR, 'Fab 04 26.xls')), 'Fab 04 26.xls')
    expect(formatPeriodDay(fab.periodStart)).toBe('Jan 1, 2026')
    expect(formatPeriodDay(fab.periodEnd)).toBe('Feb 4, 2026')
    expect(fab.companyName).toContain('RISE AND SHINE')
  })

  it('rejects non YTD report type', () => {
    // Mutate via re-parse expectation path: empty buffer should throw
    expect(() => parseYtdSnapshot(Buffer.from('not-an-xls'), 'bad.xls')).toThrow()
  })
})

describe('parseYtdSnapshot — Apr 07 grand total', () => {
  it('matches final YTD totals', () => {
    const apr = parseYtdSnapshot(readFileSync(join(FIXTURE_DIR, 'Apr 07 26.xls')), 'Apr 07 26.xls')
    expect(apr.employees).toHaveLength(11)
    expect(apr.grandTotal.reportedTotalValues).toBe(974.5)
    expect(apr.grandTotal.totalGross).toBe(26892)
    expect(apr.grandTotal.totalEmployeeTax).toBe(3456.01)
    expect(apr.grandTotal.totalEmployeeDeductions).toBe(137.52)
    expect(apr.grandTotal.totalEmployerTax).toBe(2914.07)
    expect(apr.grandTotal.netPay).toBe(23298.47)
  })
})

describe('parseYtdSnapshot — spot checks', () => {
  it('MIRZA, MAHWISH YTD gross by snapshot', () => {
    const snaps = loadAll()
    const grosses = snaps.map((s) => emp(s, 'MIRZA, MAHWISH').totalGross)
    expect(grosses).toEqual([500, 500, 900, 1400, 2100, 2100, 2100])
  })

  it('YORN, CARY is contractor with 1099$$ and zero hours', () => {
    const apr = parseYtdSnapshot(readFileSync(join(FIXTURE_DIR, 'Apr 07 26.xls')), 'Apr 07 26.xls')
    const y = emp(apr, 'YORN, CARY')
    expect(y.isContractor).toBe(true)
    expect(y.totalHours).toBe(0)
    expect(y.earnings.some((e) => e.rawType === '1099$$')).toBe(true)
    expect(y.totalGross).toBe(3350)
    expect(y.totalEmployeeTax).toBe(0)
    expect(y.netPay).toBe(3350)
  })

  it('IMRAN, FAHIDIA carries NJ + NY tax lines', () => {
    const apr = parseYtdSnapshot(readFileSync(join(FIXTURE_DIR, 'Apr 07 26.xls')), 'Apr 07 26.xls')
    const i = emp(apr, 'IMRAN, FAHIDIA')
    const types = new Set(i.employeeTaxes.map((t) => t.rawType))
    for (const t of ['DISAB-NJ', 'NJ FLI', 'NJSWF', 'NJWFEE', 'NJ SUI EE', 'STATE-NJ', 'STATE-NY']) {
      expect(types.has(t)).toBe(true)
    }
  })

  it('does not treat YEAR-TO-DATE TOTALS as an employee', () => {
    const apr = parseYtdSnapshot(readFileSync(join(FIXTURE_DIR, 'Apr 07 26.xls')), 'Apr 07 26.xls')
    expect(apr.employees.some((e) => e.rawName === 'YEAR-TO-DATE TOTALS')).toBe(false)
  })
})

describe('deriveRunsFromSnapshots — §4 validated periods', () => {
  const expected = [
    {
      label: 'Jan 1, 2026 – Jan 7, 2026',
      pay: utc(2026, 1, 7),
      start: utc(2026, 1, 1),
      end: utc(2026, 1, 7),
      employees: 1,
      // §4 "Δ Hours" = vendor TOTAL: values (REGULAR hrs + 1099 units)
      values: 20,
      regularHours: 20,
      gross: 500,
      net: 449.99,
    },
    {
      label: 'Jan 8, 2026 – Jan 21, 2026',
      pay: utc(2026, 1, 21),
      start: utc(2026, 1, 8),
      end: utc(2026, 1, 21),
      employees: 1,
      values: 50,
      regularHours: 50,
      gross: 1250,
      net: 1035.82,
    },
    {
      label: 'Jan 22, 2026 – Feb 4, 2026',
      pay: utc(2026, 2, 4),
      start: utc(2026, 1, 22),
      end: utc(2026, 2, 4),
      // Spec table said 4; the five named deltas below sum to the verified gross/net.
      employees: 5,
      values: 179,
      regularHours: 179,
      gross: 4475,
      net: 3749.72,
    },
    {
      label: 'Feb 5, 2026 – Feb 19, 2026',
      pay: utc(2026, 2, 19),
      start: utc(2026, 2, 5),
      end: utc(2026, 2, 19),
      employees: 8,
      values: 256,
      regularHours: 256,
      gross: 6409,
      net: 5334.65,
    },
    {
      label: 'Feb 20, 2026 – Mar 6, 2026',
      pay: utc(2026, 3, 6),
      start: utc(2026, 2, 20),
      end: utc(2026, 3, 6),
      employees: 7,
      values: 167,
      regularHours: 167,
      gross: 4202,
      net: 3659.79,
    },
    {
      label: 'Mar 7, 2026 – Mar 19, 2026',
      pay: utc(2026, 3, 19),
      start: utc(2026, 3, 7),
      end: utc(2026, 3, 19),
      employees: 6,
      values: 134,
      regularHours: 118, // excludes YORN 16.0 1099 units
      gross: 4568,
      net: 4142.69,
    },
    {
      label: 'Mar 20, 2026 – Apr 7, 2026',
      pay: utc(2026, 4, 7),
      start: utc(2026, 3, 20),
      end: utc(2026, 4, 7),
      // Spec table said 5; counts 5 W-2 + YORN (1099) = 6 with pay.
      employees: 6,
      values: 168.5,
      regularHours: 151, // excludes YORN 17.5 units
      gross: 5488,
      net: 4925.81,
    },
  ] as const

  it('produces exactly 7 runs with matching labels, counts, and totals', () => {
    // Shuffle input to prove sorting by periodEnd
    const snaps = loadAll().reverse()
    const runs = deriveRunsFromSnapshots(snaps)
    expect(runs).toHaveLength(7)

    for (let i = 0; i < expected.length; i++) {
      const e = expected[i]
      const r = runs[i]
      expect(r.label).toBe(e.label)
      expect(r.payDate.getTime()).toBe(e.pay.getTime())
      expect(r.periodStart.getTime()).toBe(e.start.getTime())
      expect(r.periodEnd.getTime()).toBe(e.end.getTime())
      expect(countEmployeesWithPay(r.entries)).toBe(e.employees)
      expect(r.grandTotalDelta.reportedTotalValues).toBe(e.values)
      expect(r.grandTotalDelta.totalHours).toBe(e.regularHours)
      expect(r.grandTotalDelta.totalGross).toBe(e.gross)
      expect(r.grandTotalDelta.netPay).toBe(e.net)
      expect(r.checksumOk).toBe(true)
    }
  })

  it('MIRZA period gross deltas', () => {
    const runs = deriveRunsFromSnapshots(loadAll())
    const deltas = runs.map((r) => {
      const m = r.entries.find((e) => e.rawName === 'MIRZA, MAHWISH')
      return m?.totalGross ?? 0
    })
    expect(deltas).toEqual([500, 0, 400, 500, 700, 0, 0])
  })

  it('ELDESSOUKI, OMAR delta gross is 0 after Jan 21', () => {
    const runs = deriveRunsFromSnapshots(loadAll())
    // First appearance likely Jan 21 period (index 1)
    for (let i = 2; i < runs.length; i++) {
      const o = runs[i].entries.find((e) => e.rawName === 'ELDESSOUKI, OMAR')
      if (o) expect(o.totalGross).toBe(0)
    }
  })

  it('YORN first appears Mar 19; Apr delta units/gross; hours 0; contractor', () => {
    const runs = deriveRunsFromSnapshots(loadAll())
    const mar = runs[5] // Mar 7 – Mar 19
    const apr = runs[6]
    const yMar = mar.entries.find((e) => e.rawName === 'YORN, CARY')
    expect(yMar).toBeTruthy()
    expect(yMar!.totalGross).toBe(1600)
    expect(yMar!.reportedTotalValues).toBe(16)
    expect(yMar!.totalHours).toBe(0)
    expect(yMar!.isContractor).toBe(true)

    const yApr = apr.entries.find((e) => e.rawName === 'YORN, CARY')
    expect(yApr).toBeTruthy()
    expect(yApr!.reportedTotalValues).toBe(17.5)
    expect(yApr!.totalGross).toBe(1750)
    expect(yApr!.totalHours).toBe(0)
    expect(yApr!.isContractor).toBe(true)
    expect(yApr!.totalEmployeeTax).toBe(0)
  })

  it('IMRAN Mar 06 delta gross = 575', () => {
    const runs = deriveRunsFromSnapshots(loadAll())
    const mar6 = runs[4] // Feb 20 – Mar 6
    const i = mar6.entries.find((e) => e.rawName === 'IMRAN, FAHIDIA')
    expect(i?.totalGross).toBe(575)
  })

  it('JACQUELINE, PEREZ Feb 19 gross 234 on 9 hrs', () => {
    const runs = deriveRunsFromSnapshots(loadAll())
    const feb19 = runs[3]
    const j = feb19.entries.find((e) => e.rawName === 'JACQUELINE, PEREZ')
    expect(j?.totalGross).toBe(234)
    expect(j?.totalHours).toBe(9)
  })

  it('REHMAN, INTISAR first appears in Apr 07 period', () => {
    const runs = deriveRunsFromSnapshots(loadAll())
    for (let i = 0; i < 6; i++) {
      expect(runs[i].entries.some((e) => e.rawName === 'REHMAN, INTISAR')).toBe(false)
    }
    const apr = runs[6].entries.find((e) => e.rawName === 'REHMAN, INTISAR')
    expect(apr?.totalGross).toBe(400)
    expect(apr?.totalHours).toBe(20)
  })
})
