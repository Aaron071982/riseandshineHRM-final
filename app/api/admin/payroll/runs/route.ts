import { NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const runs = await prisma.payrollRun.findMany({
    orderBy: { payDate: 'desc' },
    select: {
      id: true,
      label: true,
      payDate: true,
      periodStart: true,
      periodEnd: true,
      sourceFileName: true,
      employeeCount: true,
      totalNetPay: true,
      totalGrossPay: true,
      status: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ runs })
}
