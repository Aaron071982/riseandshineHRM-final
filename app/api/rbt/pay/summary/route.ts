import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EMPLOYEE_STUB_SELECT, stubHasEmployeePay } from '@/lib/payroll/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId!
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const stubs = await prisma.payrollRunEntry.findMany({
      where: {
        rbtProfileId,
        payrollRun: { status: 'PUBLISHED' },
      },
      select: EMPLOYEE_STUB_SELECT,
      orderBy: { payrollRun: { payDate: 'desc' } },
    })

    // Ownership double-check; hide zero-delta / empty pay stubs
    const mine = stubs
      .filter((s) => s.rbtProfileId === rbtProfileId)
      .filter(stubHasEmployeePay)

    const thisMonthNet = mine
      .filter((s) => new Date(s.payrollRun.payDate) >= monthStart)
      .reduce((sum, s) => sum + s.netPay, 0)
    const totalNetEarned = mine.reduce((sum, s) => sum + s.netPay, 0)
    const totalHours = mine.reduce((sum, s) => sum + s.totalHours, 0)

    return NextResponse.json({
      thisMonthPay: thisMonthNet,
      totalEarned: totalNetEarned,
      totalPayableHours: totalHours,
      statementCount: mine.length,
    })
  } catch (error) {
    console.error('[rbt/pay/summary]', error)
    return NextResponse.json({ error: 'Failed to load pay summary' }, { status: 500 })
  }
}
