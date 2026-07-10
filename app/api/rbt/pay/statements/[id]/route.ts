import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId!
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const statement = await prisma.rbtPayStatement.findUnique({
      where: { id },
      include: {
        sessions: { orderBy: { dos: 'asc' } },
        billingCycle: { select: { label: true, status: true } },
      },
    })

    if (!statement || statement.status !== 'FINALIZED') {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }

    // Ownership: never reveal another RBT's pay by ID guessing
    if (statement.rbtProfileId !== rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ statement })
  } catch (error) {
    console.error('[rbt/pay/statements/[id]]', error)
    return NextResponse.json({ error: 'Failed to load statement' }, { status: 500 })
  }
}
