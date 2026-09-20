import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ORIENTATION_BOOKING_SLUG } from '@/lib/onboarding/catalog'
import {
  canUnlockStep,
  completedStepNumbers,
  isTierAComplete,
  isTierBComplete,
  syncTierMilestones,
} from '@/lib/onboarding/progress'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRbtSession()
    if (auth.response) return auth.response
    const rbtProfileId = auth.user.rbtProfileId
    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as { documentId?: string }
    const documentId = typeof body.documentId === 'string' ? body.documentId : ''
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
      select: { id: true, slug: true, stepNumber: true, flowType: true, isActive: true },
    })
    if (
      !document ||
      !document.isActive ||
      document.slug !== ORIENTATION_BOOKING_SLUG ||
      document.flowType !== 'BOOKING'
    ) {
      return NextResponse.json({ error: 'Invalid booking step' }, { status: 400 })
    }

    const [docs, completions, profile] = await Promise.all([
      prisma.onboardingDocument.findMany({
        where: { isActive: true, stepNumber: { not: null } },
        select: { id: true, stepNumber: true, flowType: true, slug: true },
      }),
      prisma.onboardingCompletion.findMany({
        where: { rbtProfileId },
        select: { documentId: true, status: true },
      }),
      prisma.rBTProfile.findUniqueOrThrow({
        where: { id: rbtProfileId },
        select: {
          artemisTrainingCompleted: true,
          backgroundCheckClearedAt: true,
          supervisionCountersignedAt: true,
          fortyHourCourseCompleted: true,
          fullyActivatedAt: true,
        },
      }),
    ])

    const done = completedStepNumbers(docs, completions, profile)
    const unlocked =
      (document.stepNumber != null && canUnlockStep(document.stepNumber, done)) ||
      !!profile.fullyActivatedAt ||
      (isTierAComplete(done) && isTierBComplete(done))

    if (!unlocked) {
      return NextResponse.json({ error: 'This step is locked' }, { status: 403 })
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.onboardingCompletion.upsert({
        where: {
          rbtProfileId_documentId: { rbtProfileId, documentId: document.id },
        },
        create: {
          rbtProfileId,
          documentId: document.id,
          status: 'COMPLETED',
          completedAt: now,
        },
        update: {
          status: 'COMPLETED',
          completedAt: now,
        },
      }),
      prisma.rBTProfile.update({
        where: { id: rbtProfileId },
        data: { artemisTrainingCompleted: true },
      }),
    ])

    await syncTierMilestones(rbtProfileId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[onboarding/booking/complete]', error)
    return NextResponse.json({ error: 'Failed to mark booking complete' }, { status: 500 })
  }
}
