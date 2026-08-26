import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  markCertJourneySeen,
  requestExamFeeCover,
  setExamOutcome,
  setExamSchedule,
} from '@/lib/rbt/examJourney'

async function requireHiredRbt() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  const profile = await prisma.rBTProfile.findUnique({
    where: { id: user.rbtProfileId },
    select: { id: true, status: true },
  })
  if (
    !profile ||
    (profile.status !== 'HIRED' && profile.status !== 'ONBOARDING_COMPLETED')
  ) {
    return {
      error: NextResponse.json(
        { error: 'Available after you are hired' },
        { status: 403 }
      ),
    }
  }
  return { user, profile }
}

export async function GET() {
  const auth = await requireHiredRbt()
  if ('error' in auth && auth.error) return auth.error

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: auth.profile!.id },
    select: {
      rbtCertJourneySeenAt: true,
      rbtExamScheduledAt: true,
      rbtExamOutcome: true,
      rbtExamOutcomeAt: true,
      examFeeRequests: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          note: true,
          adminNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    },
  })

  return NextResponse.json({ profile })
}

export async function POST(request: NextRequest) {
  const auth = await requireHiredRbt()
  if ('error' in auth && auth.error) return auth.error

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    note?: string
    scheduledAt?: string
    outcome?: 'PASSED' | 'FAILED'
  }

  const rbtProfileId = auth.profile!.id
  const actorUserId = auth.user!.id

  if (body.action === 'seen') {
    await markCertJourneySeen(rbtProfileId)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'request_fee') {
    const res = await requestExamFeeCover({
      rbtProfileId,
      note: body.note,
      actorUserId,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ ok: true, id: res.id })
  }

  if (body.action === 'schedule') {
    if (!body.scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt required' }, { status: 400 })
    }
    const res = await setExamSchedule({
      rbtProfileId,
      scheduledAt: new Date(body.scheduledAt),
      actorUserId,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'outcome') {
    if (body.outcome !== 'PASSED' && body.outcome !== 'FAILED') {
      return NextResponse.json({ error: 'outcome must be PASSED or FAILED' }, { status: 400 })
    }
    await setExamOutcome({
      rbtProfileId,
      outcome: body.outcome,
      actorUserId,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
