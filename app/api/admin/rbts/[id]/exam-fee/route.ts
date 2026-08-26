import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { reviewExamFeeRequest } from '@/lib/rbt/examJourney'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rbtProfileId } = await params
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = (await request.json().catch(() => ({}))) as {
    requestId?: string
    status?: 'APPROVED' | 'DENIED'
    adminNote?: string
  }

  if (!body.requestId || (body.status !== 'APPROVED' && body.status !== 'DENIED')) {
    return NextResponse.json(
      { error: 'requestId and status (APPROVED|DENIED) required' },
      { status: 400 }
    )
  }

  const req = await prisma.rbtExamFeeRequest.findFirst({
    where: { id: body.requestId, rbtProfileId },
  })
  if (!req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  const res = await reviewExamFeeRequest({
    requestId: body.requestId,
    status: body.status,
    adminNote: body.adminNote,
    actorUserId: auth.user!.id,
  })
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
