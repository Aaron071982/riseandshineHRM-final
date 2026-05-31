import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { syncTierMilestones, canUnlockStep, completedStepNumbers } from '@/lib/onboarding/progress'
import { ESIGN_CONSENT_SLUG } from '@/lib/onboarding/catalog'
import { isMissingColumnError, migrationHintForAcknowledgmentError, prismaErrorMessage } from '@/lib/db/prisma-errors'
import type { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
      select: { id: true, flowType: true, stepNumber: true },
    })
    if (!document || document.flowType !== 'NOTICE') {
      return NextResponse.json({ error: 'Invalid notice document' }, { status: 400 })
    }

    const docs = await prisma.onboardingDocument.findMany({
      where: { isActive: true, stepNumber: { not: null } },
      select: { id: true, stepNumber: true, flowType: true, slug: true },
    })
    const completions = await prisma.onboardingCompletion.findMany({
      where: { rbtProfileId: user.rbtProfileId },
      select: { documentId: true, status: true },
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

    const where = {
      rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId },
    }
    const receiptJson = {
      type: 'NOTICE_RECEIPT',
      receivedAt: now.toISOString(),
      ip,
      userAgent: ua,
      userId: user.id,
    } as Prisma.InputJsonValue

    const minimal = {
      status: 'COMPLETED' as const,
      completedAt: now,
      acknowledgmentJson: receiptJson,
    }
    const extended = {
      ...minimal,
      signatureIpAddress: ip,
      signatureUserAgent: ua,
      signatureMethod: 'CLICK_TO_ACKNOWLEDGE',
    }

    try {
      await prisma.onboardingCompletion.upsert({
        where,
        create: { rbtProfileId: user.rbtProfileId, documentId, ...extended },
        update: extended,
      })
    } catch (err) {
      if (!isMissingColumnError(err)) throw err
      await prisma.onboardingCompletion.upsert({
        where,
        create: { rbtProfileId: user.rbtProfileId, documentId, ...minimal },
        update: minimal,
      })
    }

    try {
      await syncTierMilestones(user.rbtProfileId)
    } catch (milestoneErr) {
      console.error('[notice-receipt] syncTierMilestones failed (receipt saved)', milestoneErr)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[notice-receipt]', e)
    const migrationHint = migrationHintForAcknowledgmentError(e)
    return NextResponse.json(
      {
        error: 'Failed to save receipt',
        ...(migrationHint ? { details: migrationHint } : { details: prismaErrorMessage(e) }),
      },
      { status: 500 }
    )
  }
}
