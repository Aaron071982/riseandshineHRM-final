import 'server-only'

import { prisma } from '@/lib/prisma'
import { EMPLOYEE_STUB_SELECT, stubHasEmployeePay } from '@/lib/payroll/types'
import { DEFAULT_LABELS } from '@/lib/payroll/deductions'
import type { DeductionCode } from '@prisma/client'

export type RbtPortalDeduction = {
  label: string
  amount: number
  code?: DeductionCode
}

export type RbtPortalStub = {
  id: string
  source: 'unified' | 'legacy'
  payrollName: string
  totalHours: number
  grossPay: number
  totalDeductions: number
  netPay: number
  deductions: RbtPortalDeduction[]
  pdfAvailable: boolean
  payPeriod: {
    label: string
    payDate: string
    periodStart: string
    periodEnd: string
  }
}

function iso(d: Date): string {
  return d.toISOString()
}

/**
 * SENT unified PayStatements (preferred) + legacy published PayrollRunEntry stubs.
 * Unified PDFs download via /api/payroll/statements/[id]/download.
 */
export async function loadRbtPortalStubs(
  rbtProfileId: string
): Promise<RbtPortalStub[]> {
  const [unified, legacy] = await Promise.all([
    prisma.payStatement.findMany({
      where: {
        staffId: rbtProfileId,
        payeeType: 'RBT',
        status: 'SENT',
      },
      include: {
        payPeriod: true,
        deductionsItems: {
          where: { employeePaid: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.payrollRunEntry.findMany({
      where: {
        rbtProfileId,
        payrollRun: { status: 'PUBLISHED' },
      },
      select: EMPLOYEE_STUB_SELECT,
      orderBy: { payrollRun: { payDate: 'desc' } },
    }),
  ])

  const unifiedRows: RbtPortalStub[] = unified.map((s) => {
    const items = s.deductionsItems
    const deductionRows =
      items.length > 0
        ? items.map((d) => ({
            label: d.label,
            amount: Number(d.amount),
            code: d.code,
          }))
        : Number(s.deductions) > 0
          ? [{ label: 'Total deductions', amount: Number(s.deductions) }]
          : []
    const totalDeductions =
      deductionRows.length > 0
        ? deductionRows.reduce((sum, d) => sum + d.amount, 0)
        : Number(s.deductions)
    return {
      id: s.id,
      source: 'unified' as const,
      payrollName: 'Rise & Shine',
      totalHours: Number(s.totalHours),
      grossPay: Number(s.grossPay),
      totalDeductions,
      netPay: Number(s.netPay),
      deductions: deductionRows,
      pdfAvailable: Boolean(s.pdfUrl),
      payPeriod: {
        label: s.payPeriod.label,
        payDate: iso(s.payPeriod.payDate),
        periodStart: iso(s.payPeriod.startDate),
        periodEnd: iso(s.payPeriod.endDate),
      },
    }
  })

  const unifiedPeriodKeys = new Set(
    unifiedRows.map(
      (s) =>
        `${s.payPeriod.periodStart.slice(0, 10)}_${s.payPeriod.periodEnd.slice(0, 10)}`
    )
  )

  const legacyRows: RbtPortalStub[] = legacy
    .filter((s) => s.rbtProfileId === rbtProfileId)
    .filter(stubHasEmployeePay)
    .map((s) => {
      const periodKey = `${new Date(s.payrollRun.periodStart).toISOString().slice(0, 10)}_${new Date(s.payrollRun.periodEnd).toISOString().slice(0, 10)}`
      return { entry: s, periodKey }
    })
    .filter(({ periodKey }) => !unifiedPeriodKeys.has(periodKey))
    .map(({ entry: s }) => {
      const deductions: RbtPortalDeduction[] = (
        [
          ['FED_INCOME', s.empTaxFIT],
          ['SS', s.empTaxSS],
          ['MEDICARE', s.empTaxMed],
          ['NY_STATE', s.empTaxNYIT],
        ] as const
      )
        .filter(([, amount]) => Number(amount) > 0)
        .map(([code, amount]) => ({
          code,
          label: DEFAULT_LABELS[code],
          amount: Number(amount),
        }))
      return {
        id: s.id,
        source: 'legacy' as const,
        payrollName: s.payrollName,
        totalHours: s.totalHours,
        grossPay: s.grossPay,
        totalDeductions: s.empTaxTotal,
        netPay: s.netPay,
        deductions,
        pdfAvailable: false,
        payPeriod: {
          label: s.payrollRun.label,
          payDate: iso(new Date(s.payrollRun.payDate)),
          periodStart: iso(new Date(s.payrollRun.periodStart)),
          periodEnd: iso(new Date(s.payrollRun.periodEnd)),
        },
      }
    })

  return [...unifiedRows, ...legacyRows].sort(
    (a, b) =>
      new Date(b.payPeriod.payDate).getTime() -
      new Date(a.payPeriod.payDate).getTime()
  )
}

export async function loadRbtPortalPaySummary(rbtProfileId: string) {
  const stubs = await loadRbtPortalStubs(rbtProfileId)
  const now = new Date()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )
  const thisMonthPay = stubs
    .filter((s) => new Date(s.payPeriod.payDate) >= monthStart)
    .reduce((sum, s) => sum + s.netPay, 0)
  const totalEarned = stubs.reduce((sum, s) => sum + s.netPay, 0)
  const totalPayableHours = stubs.reduce((sum, s) => sum + s.totalHours, 0)
  return {
    thisMonthPay,
    totalEarned,
    totalPayableHours,
    statementCount: stubs.length,
  }
}

/** Flag RBT profiles currently marked isContractor on a published payroll entry. */
export async function findMisclassifiedRbtContractors(): Promise<
  {
    rbtProfileId: string
    payrollName: string
    payrollRunLabel: string
    payDate: Date
  }[]
> {
  const rows = await prisma.payrollRunEntry.findMany({
    where: {
      isContractor: true,
      rbtProfileId: { not: null },
      payrollRun: { status: 'PUBLISHED' },
    },
    select: {
      rbtProfileId: true,
      payrollName: true,
      payrollRun: { select: { label: true, payDate: true } },
    },
    orderBy: { payrollRun: { payDate: 'desc' } },
    take: 200,
  })
  return rows
    .filter((r) => r.rbtProfileId)
    .map((r) => ({
      rbtProfileId: r.rbtProfileId!,
      payrollName: r.payrollName,
      payrollRunLabel: r.payrollRun.label,
      payDate: r.payrollRun.payDate,
    }))
}
