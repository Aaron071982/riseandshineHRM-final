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

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const statements = await prisma.rbtPayStatement.findMany({
      where: {
        rbtProfileId,
        status: 'FINALIZED',
      },
      select: {
        id: true,
        finalPay: true,
        payableHours: true,
        periodStart: true,
        periodEnd: true,
      },
    })

    // Defense in depth — already filtered by rbtProfileId
    const mine = statements

    const thisMonthPay = mine
      .filter((s) => {
        const end = new Date(s.periodEnd)
        return end >= monthStart && end <= monthEnd
      })
      .reduce((sum, s) => sum + s.finalPay, 0)

    const totalEarned = mine.reduce((sum, s) => sum + s.finalPay, 0)
    const totalPayableHours = mine.reduce((sum, s) => sum + s.payableHours, 0)

    return NextResponse.json({
      thisMonthPay,
      totalEarned,
      totalPayableHours,
      statementCount: mine.length,
    })
  } catch (error) {
    console.error('[rbt/pay/summary]', error)
    return NextResponse.json({ error: 'Failed to load pay summary' }, { status: 500 })
  }
}
