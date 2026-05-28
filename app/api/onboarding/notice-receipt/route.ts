import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { syncTierMilestones, canUnlockStep, completedStepNumbers } from '@/lib/onboarding/progress'
import { ESIGN_CONSENT_SLUG } from '@/lib/onboarding/catalog'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

    const document = await prisma.onboardingDocument.findUnique({ where: { id: documentId } })
    if (!document || document.flowType !== 'NOTICE') {
      return NextResponse.json({ error: 'Invalid notice document' }, { status: 400 })
    }

    const docs = await prisma.onboardingDocument.findMany({
      where: { isActive: true, stepNumber: { not: null } },
    })
    const completions = await prisma.onboardingCompletion.findMany({
      where: { rbtProfileId: user.rbtProfileId },
    })
    const profile = await prisma.rBTProfile.findUniqueOrThrow({
      where: { id: user.rbtProfileId },
      select: {
        artemisTrainingCompleted: true,
        backgroundCheckClearedAt: true,
        supervisionCountersignedAt: true,
      },
    })
    const done = completedStepNumbers(docs, completions, profile)
    if (document.stepNumber && !canUnlockStep(document.stepNumber, done)) {
      return NextResponse.json({ error: 'This step is locked' }, { status: 403 })
    }

    const esignDone = completions.some(
      (c) => c.status === 'COMPLETED' && docs.find((d) => d.id === c.documentId)?.slug === ESIGN_CONSENT_SLUG
    )
    if (!esignDone) {
      return NextResponse.json({ error: 'Complete E-Signature Consent (Task 1) first' }, { status: 403 })
    }

    const ip = getClientIpFromRequest(request) ?? 'unknown'
    const ua = request.headers.get('user-agent') ?? 'unknown'
    const now = new Date()

    await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId },
      },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId,
        status: 'COMPLETED',
        completedAt: now,
        acknowledgmentJson: {
          type: 'NOTICE_RECEIPT',
          receivedAt: now.toISOString(),
          ip,
          userAgent: ua,
          userId: user.id,
        },
        signatureIpAddress: ip,
        signatureUserAgent: ua,
        signatureMethod: 'CLICK_TO_ACKNOWLEDGE',
      },
      update: {
        status: 'COMPLETED',
        completedAt: now,
        acknowledgmentJson: {
          type: 'NOTICE_RECEIPT',
          receivedAt: now.toISOString(),
          ip,
          userAgent: ua,
          userId: user.id,
        },
      },
    })

    await syncTierMilestones(user.rbtProfileId)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[notice-receipt]', e)
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
  }
}
