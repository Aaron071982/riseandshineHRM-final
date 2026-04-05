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
      include: {
        document: true,
        rbtProfile: { select: { firstName: true, lastName: true } },
        signatureCertificate: true,
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
      const bytes = await buildCertificatePdfBytes(cert)
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

    return NextResponse.json({
      certificate: {
        id: cert.id,
        documentTitle: cert.documentTitle,
        documentSlug: cert.documentSlug,
        signerFullName: cert.signerFullName,
        signerEmail: cert.signerEmail,
        signatureText: cert.signatureText,
        signatureTimestamp: cert.signatureTimestamp,
        signerIpAddress: cert.signerIpAddress,
        signerUserAgent: cert.signerUserAgent,
        documentHash: cert.documentHash,
        consentStatement: cert.consentStatement,
        certificateGeneratedAt: cert.certificateGeneratedAt,
        certificateJson: cert.certificateJson,
      },
    })
  } catch (e) {
    console.error('[admin certificate GET]', e)
    return NextResponse.json({ error: 'Failed to load certificate' }, { status: 500 })
  }
}
