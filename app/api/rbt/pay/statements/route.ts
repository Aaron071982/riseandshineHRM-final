import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId!
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const statements = await prisma.rbtPayStatement.findMany({
      where: {
        rbtProfileId,
        status: 'FINALIZED',
      },
      orderBy: { periodEnd: 'desc' },
      select: {
        id: true,
        rbtProfileId: true,
        billingCycleId: true,
        periodStart: true,
        periodEnd: true,
        payableStatuses: true,
        completedHours: true,
        readyToBillHours: true,
        incompleteHours: true,
        inProgressHours: true,
        scheduledHours: true,
        payableHours: true,
        hourlyRate: true,
        grossPay: true,
        adjustment: true,
        finalPay: true,
        status: true,
        createdAt: true,
      },
    })

    const scoped = statements.filter((s) => s.rbtProfileId === rbtProfileId)

    return NextResponse.json({ statements: scoped })
  } catch (error) {
    console.error('[rbt/pay/statements]', error)
    return NextResponse.json({ error: 'Failed to load pay statements' }, { status: 500 })
  }
}
