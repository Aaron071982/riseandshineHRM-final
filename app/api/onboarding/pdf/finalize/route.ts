import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { SIGNATURE_METHOD } from '@/lib/esign-constants'
import { createFillablePdfSignatureCertificate, type AuditTrailEvent } from '@/lib/signature-certificate'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rbtProfileId = user.rbtProfileId

    const body = await request.json()
    const { documentId: docIdIn, completedPdfData } = body as { documentId?: string; completedPdfData?: string }
    const documentId = typeof docIdIn === 'string' ? docIdIn.trim() : ''

    if (!documentId || typeof completedPdfData !== 'string' || !completedPdfData.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let pdfBuf: Buffer
    try {
      pdfBuf = Buffer.from(completedPdfData.trim(), 'base64')
    } catch {
      return NextResponse.json({ error: 'Invalid PDF data' }, { status: 400 })
    }
    if (pdfBuf.length === 0) {
      return NextResponse.json({ error: 'Empty PDF data' }, { status: 400 })
    }

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.type !== 'FILLABLE_PDF') {
      return NextResponse.json({ error: 'Document is not a fillable PDF type' }, { status: 400 })
    }

    const signedAt = new Date()
    const serverIp = getClientIpFromRequest(request) ?? null
    const serverUa = request.headers.get('user-agent') ?? null
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (!rbtProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const signerLabel = `${rbtProfile.firstName} ${rbtProfile.lastName}`.trim()
    const auditTrail: AuditTrailEvent[] = [
      {
        action: 'FILLABLE_PDF_SUBMITTED',
        timestamp: signedAt.toISOString(),
        ipAddress: serverIp,
        userAgent: serverUa,
      },
    ]
    const auditTrailJson = { events: auditTrail }

    const completion = await prisma.$transaction(async (tx) => {
      const comp = await tx.onboardingCompletion.upsert({
        where: {
          rbtProfileId_documentId: {
            rbtProfileId,
            documentId,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: signedAt,
          signedPdfData: completedPdfData.trim(),
          signedPdfUrl: null,
          storageBucket: null,
          draftData: Prisma.JsonNull,
          signatureText: signerLabel || null,
          signatureTimestamp: signedAt,
          signatureIpAddress: serverIp,
          signatureUserAgent: serverUa,
          signatureConsentGiven: true,
          signatureMethod: SIGNATURE_METHOD.UPLOADED,
          auditTrailJson: auditTrailJson as object,
        },
        create: {
          rbtProfileId,
          documentId,
          status: 'COMPLETED',
          completedAt: signedAt,
          signedPdfData: completedPdfData.trim(),
          signatureText: signerLabel || null,
          signatureTimestamp: signedAt,
          signatureIpAddress: serverIp,
          signatureUserAgent: serverUa,
          signatureConsentGiven: true,
          signatureMethod: SIGNATURE_METHOD.UPLOADED,
          auditTrailJson: auditTrailJson as object,
        },
      })

      await createFillablePdfSignatureCertificate(tx, {
        completionId: comp.id,
        rbtProfileId,
        document: {
          id: document.id,
          title: document.title,
          slug: document.slug,
        },
        rbtProfile,
        userEmail: user.email ?? null,
        pdfBuffer: pdfBuf,
        signatureTimestamp: signedAt,
        signerIpAddress: serverIp,
        signerUserAgent: serverUa,
        auditTrail,
        timezone: tz,
      })

      return comp
    })

    return NextResponse.json({ success: true, completion })
  } catch (error: unknown) {
    console.error('Error finalizing PDF:', error)
    return NextResponse.json({ error: 'Failed to finalize PDF' }, { status: 500 })
  }
}
