import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT, SIGNATURE_METHOD } from '@/lib/esign-constants'
import { sha256DocumentPdfSource, type AuditTrailEvent } from '@/lib/signature-certificate'
import { sendEmail, EmailTemplateType, generateDocumentSignedReceiptEmail } from '@/lib/email'
import { ESIGN_CONSENT_SLUG } from '@/lib/onboarding/catalog'
import { syncTierMilestones, canUnlockStep, completedStepNumbers } from '@/lib/onboarding/progress'
import {
  tryCreateAcknowledgmentCertificate,
  trySetSupervisionContractPending,
  upsertAcknowledgmentCompletion,
  upsertEsignConsentProfile,
} from '@/lib/onboarding/acknowledge-persist'
import { migrationHintForAcknowledgmentError, prismaErrorMessage } from '@/lib/db/prisma-errors'

function isTwoOrMoreWords(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2
}

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  slug: true,
  type: true,
  flowType: true,
  stepNumber: true,
  pdfData: true,
  pdfUrl: true,
} as const

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role !== 'RBT' && user.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      documentId,
      typedName,
      readConfirmed,
      agreeConfirmed,
      signatureConsentGiven,
      consentStatement,
      auditTrail: clientAuditTrail,
      timezone,
    } = body as {
      documentId?: string
      typedName?: string
      readConfirmed?: boolean
      agreeConfirmed?: boolean
      signatureConsentGiven?: boolean
      consentStatement?: string
      auditTrail?: AuditTrailEvent[]
      timezone?: string
    }

    if (!documentId || typeof typedName !== 'string' || !readConfirmed || !agreeConfirmed) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!signatureConsentGiven) {
      return NextResponse.json(
        { error: 'You must agree to the electronic signature statement before signing.' },
        { status: 400 }
      )
    }

    if (consentStatement !== PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT) {
      return NextResponse.json({ error: 'Invalid consent statement' }, { status: 400 })
    }

    const trimmedName = typedName.trim()
    if (!trimmedName || !isTwoOrMoreWords(trimmedName)) {
      return NextResponse.json(
        { error: 'Please type your full legal name (first and last).' },
        { status: 400 }
      )
    }

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
      select: DOCUMENT_SELECT,
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.flowType !== 'ESIGN' && document.type !== 'ACKNOWLEDGMENT') {
      return NextResponse.json({ error: 'Document is not an e-sign acknowledgment' }, { status: 400 })
    }

    const isEsignConsent = document.slug === ESIGN_CONSENT_SLUG

    if (!isEsignConsent) {
      const docs = await prisma.onboardingDocument.findMany({
        where: { isActive: true, stepNumber: { not: null } },
        select: { id: true, stepNumber: true, flowType: true, slug: true },
      })
      const completions = await prisma.onboardingCompletion.findMany({
        where: { rbtProfileId: user.rbtProfileId! },
        select: { documentId: true, status: true },
      })
      const rbtFlags = await prisma.rBTProfile.findUniqueOrThrow({
        where: { id: user.rbtProfileId! },
        select: {
          artemisTrainingCompleted: true,
          backgroundCheckClearedAt: true,
          supervisionCountersignedAt: true,
        },
      })
      const done = completedStepNumbers(docs, completions, rbtFlags)
      if (document.stepNumber && !canUnlockStep(document.stepNumber, done)) {
        return NextResponse.json({ error: 'This step is locked' }, { status: 403 })
      }
      const esignDone = completions.some(
        (c) =>
          c.status === 'COMPLETED' &&
          docs.find((d) => d.id === c.documentId)?.slug === ESIGN_CONSENT_SLUG
      )
      if (!esignDone) {
        return NextResponse.json(
          { error: 'Complete E-Signature Consent (Task 1) before signing other documents.' },
          { status: 403 }
        )
      }
    }

    const serverIp = getClientIpFromRequest(request) ?? 'unknown'
    const serverUa = request.headers.get('user-agent') ?? 'unknown'
    const signedAt = new Date()
    const tz = typeof timezone === 'string' && timezone.length > 0 ? timezone : 'America/New_York'

    const clientEvents = Array.isArray(clientAuditTrail) ? clientAuditTrail : []
    const normalizedClient: AuditTrailEvent[] = clientEvents.map((e) => ({
      ...e,
      timestamp: typeof e.timestamp === 'string' ? e.timestamp : signedAt.toISOString(),
    }))

    const auditTrail: AuditTrailEvent[] = [
      ...normalizedClient,
      {
        action: 'DOCUMENT_SUBMITTED',
        timestamp: signedAt.toISOString(),
        ipAddress: serverIp,
        userAgent: serverUa,
        signatureText: trimmedName,
      },
    ]

    const auditTrailJson = { events: auditTrail }

    const acknowledgmentJson = {
      typedName: trimmedName,
      readConfirmed,
      agreeConfirmed,
      timestamp: signedAt.toISOString(),
      ip: serverIp,
      userAgent: serverUa,
      consentStatement: PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
      signatureConsentGiven: true,
      signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
      auditTrail: auditTrailJson,
    }

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: user.rbtProfileId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!rbtProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { documentHash, integrityNote } = await sha256DocumentPdfSource({
      pdfData: document.pdfData,
      pdfUrl: document.pdfUrl,
    })

    let certificateCreated = true
    const completion = await prisma.$transaction(async (tx) => {
      const comp = await upsertAcknowledgmentCompletion(tx, {
        rbtProfileId: user.rbtProfileId!,
        documentId,
        signedAt,
        acknowledgmentJson,
        trimmedName,
        serverIp,
        serverUa,
        auditTrailJson,
      })

      const certResult = await tryCreateAcknowledgmentCertificate(tx, {
        completionId: comp.id,
        rbtProfileId: user.rbtProfileId!,
        document: {
          id: document.id,
          title: document.title,
          slug: document.slug,
          pdfData: document.pdfData,
          pdfUrl: document.pdfUrl,
        },
        rbtProfile,
        userEmail: user.email ?? null,
        signatureText: trimmedName,
        signatureTimestamp: signedAt,
        signerIpAddress: serverIp,
        signerUserAgent: serverUa,
        consentStatement: PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
        consentAgreedAtIso: signedAt.toISOString(),
        auditTrail,
        timezone: tz,
        documentHash,
        integrityNote,
      })
      certificateCreated = certResult.created

      if (document.slug === ESIGN_CONSENT_SLUG) {
        await upsertEsignConsentProfile(tx, user.id, signedAt)
      }

      if (document.slug === 'rbt-supervision-contract') {
        await trySetSupervisionContractPending(tx, user.rbtProfileId!)
      }

      return comp
    })

    try {
      await syncTierMilestones(user.rbtProfileId!)
    } catch (milestoneErr) {
      console.error('[onboarding/acknowledge] syncTierMilestones failed (completion saved)', milestoneErr)
    }

    const toEmail = rbtProfile.email || user.email
    if (toEmail) {
      try {
        const html = generateDocumentSignedReceiptEmail({
          documentTitle: document.title,
          signerName: trimmedName,
          signedAtUtc: signedAt,
        })
        await sendEmail({
          to: toEmail,
          subject: `Document signed — ${document.title}`,
          html,
          templateType: EmailTemplateType.DOCUMENT_SIGNATURE_RECEIPT,
          rbtProfileId: user.rbtProfileId!,
        })
      } catch (emailErr) {
        console.error('[onboarding/acknowledge] receipt email failed', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      completion,
      certificateCreated,
      ...(certificateCreated
        ? {}
        : {
            certificateWarning:
              'Document signed, but the signature certificate could not be saved. HR has been notified via your completion record.',
          }),
    })
  } catch (error: unknown) {
    console.error('Error saving acknowledgment:', error)
    const message = prismaErrorMessage(error)
    const migrationHint = migrationHintForAcknowledgmentError(error)
    return NextResponse.json(
      {
        error: 'Failed to save acknowledgment',
        ...(migrationHint ? { details: migrationHint } : { details: message }),
      },
      { status: 500 }
    )
  }
}
