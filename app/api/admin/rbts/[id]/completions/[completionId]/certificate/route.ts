import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildCertificatePdfBytes } from '@/lib/signature-certificate-pdf'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; completionId: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id: rbtProfileId, completionId } = await params
  const format = request.nextUrl.searchParams.get('format')

  try {
    const completion = await prisma.onboardingCompletion.findFirst({
      where: { id: completionId, rbtProfileId },
      select: {
        id: true,
        document: {
          select: { type: true, slug: true, title: true },
        },
        rbtProfile: { select: { firstName: true, lastName: true } },
        auditTrailJson: true,
        signatureText: true,
        signatureTimestamp: true,
        signatureIpAddress: true,
        signatureUserAgent: true,
        acknowledgmentJson: true,
        signatureCertificate: {
          select: {
            id: true,
            documentTitle: true,
            documentSlug: true,
            signerFullName: true,
            signerEmail: true,
            signatureText: true,
            signatureTimestamp: true,
            signerIpAddress: true,
            signerUserAgent: true,
            documentHash: true,
            consentStatement: true,
            certificateGeneratedAt: true,
          },
        },
      },
    })

    if (!completion) {
      return NextResponse.json({ error: 'Completion not found' }, { status: 404 })
    }

    if (completion.document.type !== 'ACKNOWLEDGMENT' && completion.document.type !== 'FILLABLE_PDF') {
      return NextResponse.json(
        { error: 'Certificate is only for acknowledgment or fillable PDF documents' },
        { status: 400 }
      )
    }

    const cert = completion.signatureCertificate
    if (!cert) {
      return NextResponse.json({ error: 'No signature certificate for this completion' }, { status: 404 })
    }

    if (format === 'pdf') {
      const fullCert = await prisma.signatureCertificate.findUnique({
        where: { id: cert.id },
        select: {
          documentTitle: true,
          documentSlug: true,
          signerFullName: true,
          signerEmail: true,
          signatureText: true,
          signatureTimestamp: true,
          signerIpAddress: true,
          signerUserAgent: true,
          documentHash: true,
          consentStatement: true,
          certificateGeneratedAt: true,
          certificateJson: true,
        },
      })
      if (!fullCert) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
      }
      const bytes = await buildCertificatePdfBytes(fullCert)
      const safeName = `${completion.rbtProfile.firstName}-${completion.rbtProfile.lastName}-${completion.document.slug}`
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '')
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}-certificate.pdf"`,
        },
      })
    }

    const { getCompletionAuditEvents } = await import('@/lib/acknowledgment-audit-display')
    const auditTrail = getCompletionAuditEvents({
      auditTrailJson: completion.auditTrailJson,
      acknowledgmentJson: completion.acknowledgmentJson,
      signatureText: completion.signatureText ?? cert.signatureText,
      signatureTimestamp: completion.signatureTimestamp ?? cert.signatureTimestamp,
      signatureIpAddress: completion.signatureIpAddress ?? cert.signerIpAddress,
      signatureUserAgent: completion.signatureUserAgent ?? cert.signerUserAgent,
      completedAt: null,
    })

    return NextResponse.json({
      certificate: {
        id: cert.id,
        documentTitle: cert.documentTitle,
        documentSlug: cert.documentSlug,
        signerFullName: cert.signerFullName,
        signerEmail: cert.signerEmail,
        signatureText: cert.signatureText,
        signatureTimestamp: cert.signatureTimestamp.toISOString(),
        signerIpAddress: cert.signerIpAddress,
        signerUserAgent: cert.signerUserAgent,
        documentHash: cert.documentHash,
        consentStatement: cert.consentStatement,
        certificateGeneratedAt: cert.certificateGeneratedAt.toISOString(),
        certificateJson: { auditTrail },
      },
    })
  } catch (e) {
    console.error('[admin certificate GET]', e)
    return NextResponse.json({ error: 'Failed to load certificate' }, { status: 500 })
  }
}
