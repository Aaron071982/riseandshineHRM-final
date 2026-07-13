import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Recent payroll runs for executive dashboard chart. */
export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const runs = await prisma.payrollRun.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { payDate: 'desc' },
    take: 12,
    select: {
      id: true,
      label: true,
      payDate: true,
      totalNetPay: true,
      employeeCount: true,
      status: true,
    },
  })

  const chronological = [...runs].reverse()
  const latest = runs[0] ?? null

  return NextResponse.json({
    runs: chronological.map((r) => ({
      id: r.id,
      label: r.label,
      payDate: r.payDate.toISOString().slice(0, 10),
      totalNetPay: r.totalNetPay,
      employeeCount: r.employeeCount,
    })),
    latest: latest
      ? {
          id: latest.id,
          label: latest.label,
          payDate: latest.payDate.toISOString().slice(0, 10),
          totalNetPay: latest.totalNetPay,
          employeeCount: latest.employeeCount,
        }
      : null,
  })
}
