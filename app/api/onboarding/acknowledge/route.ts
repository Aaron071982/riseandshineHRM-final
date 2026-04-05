import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT, SIGNATURE_METHOD } from '@/lib/esign-constants'
import { createLiveSignatureCertificate, type AuditTrailEvent } from '@/lib/signature-certificate'
import { sendEmail, EmailTemplateType, generateDocumentSignedReceiptEmail } from '@/lib/email'

function isTwoOrMoreWords(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2
}

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

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { eSignConsentGiven: true },
    })
    if (!profile?.eSignConsentGiven) {
      return NextResponse.json(
        { error: 'Portal electronic signature consent is required. Return to My Tasks and accept the consent banner first.' },
        { status: 403 }
      )
    }

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.type !== 'ACKNOWLEDGMENT') {
      return NextResponse.json({ error: 'Document is not an acknowledgment type' }, { status: 400 })
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
    }

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: user.rbtProfileId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!rbtProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const completion = await prisma.$transaction(async (tx) => {
      const comp = await tx.onboardingCompletion.upsert({
        where: {
          rbtProfileId_documentId: {
            rbtProfileId: user.rbtProfileId!,
            documentId,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: signedAt,
          acknowledgmentJson: acknowledgmentJson as object,
          signatureText: trimmedName,
          signatureTimestamp: signedAt,
          signatureIpAddress: serverIp,
          signatureUserAgent: serverUa,
          signatureConsentGiven: true,
          signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
          auditTrailJson: auditTrailJson as object,
        },
        create: {
          rbtProfileId: user.rbtProfileId!,
          documentId,
          status: 'COMPLETED',
          completedAt: signedAt,
          acknowledgmentJson: acknowledgmentJson as object,
          signatureText: trimmedName,
          signatureTimestamp: signedAt,
          signatureIpAddress: serverIp,
          signatureUserAgent: serverUa,
          signatureConsentGiven: true,
          signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
          auditTrailJson: auditTrailJson as object,
        },
      })

      await createLiveSignatureCertificate(tx, {
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
      })

      return comp
    })

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

    return NextResponse.json({ success: true, completion })
  } catch (error: unknown) {
    console.error('Error saving acknowledgment:', error)
    return NextResponse.json({ error: 'Failed to save acknowledgment' }, { status: 500 })
  }
}
