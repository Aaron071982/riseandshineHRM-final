import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EMPLOYEE_STUB_SELECT, stubHasEmployeePay } from '@/lib/payroll/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId!
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stub = await prisma.payrollRunEntry.findUnique({
      where: { id: params.id },
      select: EMPLOYEE_STUB_SELECT,
    })

    if (!stub || stub.payrollRun.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (stub.rbtProfileId !== rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!stubHasEmployeePay(stub)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ stub })
  } catch (error) {
    console.error('[rbt/pay/stubs/id]', error)
    return NextResponse.json({ error: 'Failed to load pay stub' }, { status: 500 })
  }
}
