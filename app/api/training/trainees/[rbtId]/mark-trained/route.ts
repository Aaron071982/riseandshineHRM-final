import { NextResponse } from 'next/server'
import { canOverrideTrainingRequirement, requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { completeArtemisTrainingWithoutSession } from '@/lib/training/attendance'
import { RBTStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ rbtId: string }> }
) {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  if (!canOverrideTrainingRequirement(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { rbtId } = await params

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtId },
    select: { id: true, status: true, artemisTrainingCompleted: true },
  })

  if (!profile) {
    return NextResponse.json({ error: 'RBT not found' }, { status: 404 })
  }
  if (profile.status !== RBTStatus.HIRED && profile.status !== RBTStatus.ONBOARDING_COMPLETED) {
    return NextResponse.json({ error: 'RBT must be hired' }, { status: 400 })
  }
  if (profile.artemisTrainingCompleted) {
    return NextResponse.json({ success: true, alreadyTrained: true })
  }

  await completeArtemisTrainingWithoutSession({
    rbtProfileId: rbtId,
    actorUser: auth.user,
  })

  return NextResponse.json({ success: true })
}
