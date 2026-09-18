import { prisma } from '@/lib/prisma'
import { Prisma, type DeductionCode } from '@prisma/client'
import { round2 } from '@/lib/payroll/hoursHmm'

export type PayDeductionInput = {
  code: DeductionCode
  label: string
  amount: number
  employeePaid?: boolean
}

const DEFAULT_LABELS: Record<DeductionCode, string> = {
  FED_INCOME: 'Federal income tax',
  SS: 'Social Security',
  MEDICARE: 'Medicare',
  NY_STATE: 'NY State tax',
  NYC_LOCAL: 'NYC local tax',
  NY_SDI: 'NY SDI',
  NY_PFL: 'NY Paid Family Leave',
  OTHER: 'Other deduction',
}

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(round2(n).toFixed(2))
}

/** Map legacy PayrollRunEntry tax columns → stored deduction rows (no tax math). */
export function deductionsFromLegacyPayrollEntry(entry: {
  empTaxFIT?: number | null
  empTaxSS?: number | null
  empTaxMed?: number | null
  empTaxNYIT?: number | null
  empTaxTotal?: number | null
}): PayDeductionInput[] {
  const rows: PayDeductionInput[] = []
  const push = (code: DeductionCode, amount: number | null | undefined) => {
    const n = Number(amount ?? 0)
    if (!(n > 0)) return
    rows.push({
      code,
      label: DEFAULT_LABELS[code],
      amount: n,
      employeePaid: true,
    })
  }
  push('FED_INCOME', entry.empTaxFIT)
  push('SS', entry.empTaxSS)
  push('MEDICARE', entry.empTaxMed)
  push('NY_STATE', entry.empTaxNYIT)
  return rows
}

/**
 * Replace all deduction rows on a statement and refresh deductions/net/reconciled.
 * Gross remains Σ line items (source of truth).
 */
export async function replacePayDeductions(input: {
  payStatementId: string
  deductions: PayDeductionInput[]
}): Promise<{
  deductions: number
  netPay: number
  reconciled: boolean
}> {
  const statement = await prisma.payStatement.findUnique({
    where: { id: input.payStatementId },
    include: {
      lineItems: { select: { hours: true, amount: true } },
    },
  })
  if (!statement) throw new Error('Pay statement not found')
  if (statement.status === 'SENT') {
    throw new Error('Cannot edit deductions on a sent pay statement')
  }

  const employeePaid = input.deductions.filter((d) => d.employeePaid !== false)
  const deductionsTotal = round2(
    employeePaid.reduce((sum, d) => sum + Number(d.amount), 0)
  )
  const lineAmountSum = round2(
    statement.lineItems.reduce((sum, li) => sum + Number(li.amount), 0)
  )
  const grossPay = lineAmountSum
  const netPay = round2(grossPay - deductionsTotal)
  const storedNet = Number(statement.netPay)
  const storedGross = Number(statement.grossPay)
  // Reconciled when stored gross matches lines AND net ties to gross − employee deductions.
  const reconciled =
    Math.abs(storedGross - lineAmountSum) < 0.005 &&
    Math.abs(netPay - (grossPay - deductionsTotal)) < 0.005

  await prisma.$transaction(async (tx) => {
    await tx.payDeduction.deleteMany({
      where: { payStatementId: statement.id },
    })
    if (input.deductions.length > 0) {
      await tx.payDeduction.createMany({
        data: input.deductions.map((d) => ({
          payStatementId: statement.id,
          code: d.code,
          label: d.label.trim() || DEFAULT_LABELS[d.code],
          amount: dec(Number(d.amount)),
          employeePaid: d.employeePaid !== false,
        })),
      })
    }
    await tx.payStatement.update({
      where: { id: statement.id },
      data: {
        deductions: dec(deductionsTotal),
        netPay: dec(netPay),
        grossPay: dec(grossPay),
        reconciled:
          Math.abs(grossPay - lineAmountSum) < 0.005 &&
          Math.abs(netPay - round2(grossPay - deductionsTotal)) < 0.005,
        status: statement.status === 'READY' ? 'DRAFT' : statement.status,
        pdfUrl: statement.status === 'READY' ? null : statement.pdfUrl,
      },
    })
  })

  void storedNet
  void reconciled

  return {
    deductions: deductionsTotal,
    netPay,
    reconciled:
      Math.abs(grossPay - lineAmountSum) < 0.005 &&
      Math.abs(netPay - round2(grossPay - deductionsTotal)) < 0.005,
  }
}

export { DEFAULT_LABELS }
