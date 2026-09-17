import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT, SIGNATURE_METHOD } from '@/lib/esign-constants'
import { getBcbaOnboardingProgress } from '@/lib/onboarding/bcbaProgress'

function isTwoOrMoreWords(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user?.bcbaProfileId || user.role !== 'BCBA') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const documentId = typeof body?.documentId === 'string' ? body.documentId : ''
    const typedName = typeof body?.typedName === 'string' ? body.typedName.trim() : ''
    const readConfirmed = body?.readConfirmed === true
    const agreeConfirmed = body?.agreeConfirmed === true
    const perDocConsent = body?.perDocConsent === true
    const auditTrail = Array.isArray(body?.auditTrail) ? body.auditTrail : []

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }
    if (!readConfirmed || !agreeConfirmed || !perDocConsent) {
      return NextResponse.json({ error: 'All acknowledgments are required' }, { status: 400 })
    }
    if (!isTwoOrMoreWords(typedName)) {
      return NextResponse.json(
        { error: 'Type your full legal name (first and last)' },
        { status: 400 }
      )
    }

    const progress = await getBcbaOnboardingProgress(user.bcbaProfileId)
    const step = progress.steps.find((s) => s.document.id === documentId)
    if (!step) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (step.isLocked) {
      return NextResponse.json({ error: 'Complete prior steps first' }, { status: 403 })
    }
    if (step.document.flowType !== 'ESIGN') {
      return NextResponse.json({ error: 'This document is not an acknowledgment' }, { status: 400 })
    }

    const signedAt = new Date()
    const serverIp = getClientIpFromRequest(request)
    const serverUa = request.headers.get('user-agent') || null

    const completion = await prisma.bcbaOnboardingCompletion.upsert({
      where: {
        bcbaProfileId_documentId: {
          bcbaProfileId: user.bcbaProfileId,
          documentId,
        },
      },
      update: {
        status: 'COMPLETED',
        completedAt: signedAt,
        acknowledgmentJson: {
          typedName,
          readConfirmed,
          agreeConfirmed,
          perDocConsent,
          consentStatement: PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
          signedAt: signedAt.toISOString(),
        },
        signatureText: typedName,
        signatureTimestamp: signedAt,
        signatureIpAddress: serverIp,
        signatureUserAgent: serverUa,
        signatureConsentGiven: true,
        signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
        auditTrailJson: auditTrail,
      },
      create: {
        bcbaProfileId: user.bcbaProfileId,
        documentId,
        status: 'COMPLETED',
        completedAt: signedAt,
        acknowledgmentJson: {
          typedName,
          readConfirmed,
          agreeConfirmed,
          perDocConsent,
          consentStatement: PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
          signedAt: signedAt.toISOString(),
        },
        signatureText: typedName,
        signatureTimestamp: signedAt,
        signatureIpAddress: serverIp,
        signatureUserAgent: serverUa,
        signatureConsentGiven: true,
        signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
        auditTrailJson: auditTrail,
      },
    })

    await getBcbaOnboardingProgress(user.bcbaProfileId)

    return NextResponse.json({
      success: true,
      completion: {
        id: completion.id,
        documentId: completion.documentId,
        status: completion.status,
        completedAt: completion.completedAt?.toISOString() ?? null,
      },
    })
  } catch (e) {
    console.error('[bcba/onboarding/acknowledge]', e)
    return NextResponse.json({ error: 'Failed to save acknowledgment' }, { status: 500 })
  }
}
