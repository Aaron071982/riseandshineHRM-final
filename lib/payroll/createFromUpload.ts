import type { SessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parsePayrollRegister } from './parse'
import { matchPayrollNameToRbt } from './match'

export async function createPayrollRunFromUpload(file: File, user: SessionUser) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parsePayrollRegister(buffer)

  const candidates = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: { id: true, firstName: true, lastName: true, payrollName: true },
  })

  const usedProfileIds = new Set<string>()
  const matchedRows = parsed.rows.map((row) => {
    let match = matchPayrollNameToRbt(row.payrollName, candidates)
    if (match.rbtProfileId && usedProfileIds.has(match.rbtProfileId)) {
      match = {
        ...match,
        matchStatus: 'NEEDS_REVIEW',
        rbtProfileId: null,
        suggestedRbtProfileId: match.rbtProfileId,
      }
    }
    if (match.rbtProfileId) usedProfileIds.add(match.rbtProfileId)
    return { row, match }
  })

  const payDate = parsed.payDate ?? new Date()
  const periodStart = parsed.periodStart ?? payDate
  const periodEnd = parsed.periodEnd ?? payDate
  const totalNetPay = matchedRows.reduce((s, r) => s + r.row.netPay, 0)
  const totalGrossPay = matchedRows.reduce((s, r) => s + r.row.grossPay, 0)

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        label: parsed.label,
        payDate,
        periodStart,
        periodEnd,
        sourceFileName: file.name,
        uploadedById: user.id,
        employeeCount: matchedRows.length,
        totalNetPay,
        totalGrossPay,
        status: 'DRAFT',
      },
    })

    await tx.payrollRunEntry.createMany({
      data: matchedRows.map(({ row, match }) => ({
        payrollRunId: created.id,
        rbtProfileId: match.rbtProfileId,
        payrollName: row.payrollName,
        matchStatus: match.matchStatus,
        matchConfidence: match.matchConfidence,
        totalHours: row.totalHours,
        grossPay: row.grossPay,
        adjustedGross: row.adjustedGross || row.grossPay,
        empTaxTotal: row.empTaxTotal,
        empTaxFIT: row.empTaxFIT,
        empTaxSS: row.empTaxSS,
        empTaxMed: row.empTaxMed,
        empTaxNYIT: row.empTaxNYIT,
        netPay: row.netPay,
        employerTaxTotal: row.employerTaxTotal,
        totalPayrollCost: row.totalPayrollCost,
      })),
    })

    return created
  })

  const entries = await prisma.payrollRunEntry.findMany({
    where: { payrollRunId: run.id },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { payrollName: 'asc' },
  })

  return {
    run,
    preview: {
      employeeCount: matchedRows.length,
      periodLabel: parsed.label,
      totalNetPay,
      totalGrossPay,
      matched: entries.filter((e) => e.matchStatus === 'MATCHED').length,
      needsReview: entries.filter((e) => e.matchStatus === 'NEEDS_REVIEW').length,
      unmatched: entries.filter((e) => e.matchStatus === 'UNMATCHED').length,
    },
    entries,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
    })),
  }
}
