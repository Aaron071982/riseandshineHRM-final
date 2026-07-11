import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EMPLOYEE_STUB_SELECT } from '@/lib/payroll/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId!
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stubs = await prisma.payrollRunEntry.findMany({
      where: {
        rbtProfileId,
        payrollRun: { status: 'PUBLISHED' },
      },
      select: EMPLOYEE_STUB_SELECT,
      orderBy: { payrollRun: { payDate: 'desc' } },
    })

    const mine = stubs.filter((s) => s.rbtProfileId === rbtProfileId)
    return NextResponse.json({ stubs: mine })
  } catch (error) {
    console.error('[rbt/pay/stubs]', error)
    return NextResponse.json({ error: 'Failed to load pay stubs' }, { status: 500 })
  }
}
