import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildPayrollWorkbook, payrollExportFilename } from '@/lib/billing/excelExport'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await prisma.billingCycle.findUnique({ where: { id: params.id } })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const entries = await prisma.billingEntry.findMany({
    where: {
      billingCycleId: params.id,
      isExcluded: false,
      matchStatus: { in: ['MATCHED', 'PAYROLL_ONLY'] },
    },
    include: {
      rbtProfile: { select: { firstName: true, lastName: true } },
      payrollOnly: { select: { fullName: true } },
    },
    orderBy: { providerNameRaw: 'asc' },
  })

  const sessions = await prisma.billingSession.findMany({
    where: {
      billingEntry: {
        billingCycleId: params.id,
        isExcluded: false,
        matchStatus: { in: ['MATCHED', 'PAYROLL_ONLY'] },
      },
    },
    include: {
      billingEntry: {
        include: {
          rbtProfile: { select: { firstName: true, lastName: true } },
          payrollOnly: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ billingEntryId: 'asc' }, { dos: 'asc' }],
  })

  const buffer = await buildPayrollWorkbook(cycle, entries, sessions)
  const filename = payrollExportFilename(cycle.periodStart, cycle.periodEnd)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
