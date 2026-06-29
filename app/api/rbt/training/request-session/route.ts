import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyArtemisSessionRequest } from '@/lib/training/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response

  const rbtProfileId = auth.user.rbtProfileId!
  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim() : null

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      status: true,
      artemisTrainingCompleted: true,
    },
  })

  if (!profile || profile.status !== 'HIRED') {
    return NextResponse.json({ error: 'Must be a hired RBT' }, { status: 403 })
  }
  if (profile.artemisTrainingCompleted) {
    return NextResponse.json({ error: 'Training already completed' }, { status: 400 })
  }

  const existingOpen = await prisma.artemisSessionRequest.findFirst({
    where: { rbtProfileId, status: 'OPEN' },
  })
  if (existingOpen) {
    return NextResponse.json({ error: 'You already have an open request' }, { status: 409 })
  }

  await prisma.artemisSessionRequest.create({
    data: {
      rbtProfileId,
      message: message || null,
      status: 'OPEN',
    },
  })

  await notifyArtemisSessionRequest({ rbtProfile: profile, message })

  return NextResponse.json({
    success: true,
    message: 'Request submitted — training team will reach out.',
  })
}
