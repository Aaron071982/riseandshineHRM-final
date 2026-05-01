import { NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth } from 'date-fns'
import { activeCrmRbtAssignmentWhere } from '@/lib/crm-client/assignments'
import { hoursRunningLow } from '@/lib/crm-client/display'
import { startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  try {
    const now = new Date()
    const monthStart = startOfMonth(now)

    const [activeCount, newIntakeMonth, activeClients] = await Promise.all([
      prisma.crmClient.count({ where: { status: 'ACTIVE' } }),
      prisma.crmClient.count({
        where: { status: 'NEW_INTAKE', createdAt: { gte: monthStart } },
      }),
      prisma.crmClient.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          usedHoursTotal: true,
          authorizedHoursPerWeek: true,
          authorizationStartDate: true,
          authorizationEndDate: true,
          rbtAssignments: {
            where: activeCrmRbtAssignmentWhere(),
            select: { id: true },
          },
        },
      }),
    ])

    const noRbt = activeClients.filter((c) => c.rbtAssignments.length === 0).length

    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const authExpiringSoon = await prisma.crmClient.count({
      where: {
        status: 'ACTIVE',
        authorizationEndDate: {
          not: null,
          lte: thirtyDays,
          gte: startOfDay(now),
        },
      },
    })

    const hoursLow = activeClients.filter((c) =>
      hoursRunningLow({
        usedHoursTotal: c.usedHoursTotal,
        authorizedHoursPerWeek: c.authorizedHoursPerWeek,
        authorizationStartDate: c.authorizationStartDate,
      })
    ).length

    return NextResponse.json({
      activeClients: activeCount,
      noRbtAssigned: noRbt,
      authExpiringSoon: authExpiringSoon,
      newIntakeThisMonth: newIntakeMonth,
      hoursRunningLow: hoursLow,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load client stats', details: String(e) },
      { status: 500 }
    )
  }
}
