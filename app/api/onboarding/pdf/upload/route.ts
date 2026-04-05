import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
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

    const formData = await request.formData()
    const documentIdRaw = formData.get('documentId')
    const documentId = typeof documentIdRaw === 'string' ? documentIdRaw.trim() : ''
    const filledPdfBlob = formData.get('filledPdf') as File | null
    const fieldValuesStr = formData.get('fieldValues') as string | null

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    if (!filledPdfBlob || !(filledPdfBlob instanceof File)) {
      return NextResponse.json({ error: 'Missing filled PDF file' }, { status: 400 })
    }

    // Parse field values if provided
    let fieldValues: Record<string, any> | null = null
    if (fieldValuesStr) {
      try {
        fieldValues = JSON.parse(fieldValuesStr)
      } catch (e) {
        console.warn('Failed to parse fieldValues JSON:', e)
      }
    }

    // Verify document exists and is a fillable PDF type
    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.type !== 'FILLABLE_PDF') {
      return NextResponse.json(
        { error: 'Document is not a fillable PDF type' },
        { status: 400 }
      )
    }

    // Verify rbtProfileId matches
    if (user.rbtProfileId !== user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if Supabase admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase Storage not configured. Please set SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await filledPdfBlob.arrayBuffer()
    const pdfBytes = new Uint8Array(arrayBuffer)

    // Generate storage path with document slug: rbts/{rbtProfileId}/{documentId}/{documentSlug}-{timestamp}.pdf
    const timestamp = Date.now()
    const storagePath = `rbts/${rbtProfileId}/${documentId}/${document.slug}-${timestamp}.pdf`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false, // Don't overwrite existing files
      })

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError)
      return NextResponse.json(
        { error: `Failed to upload PDF to storage: ${uploadError.message}` },
        { status: 500 }
      )
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

    const pdfBuf = Buffer.from(pdfBytes)

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
          signedPdfUrl: storagePath,
          signedPdfData: null,
          storageBucket: STORAGE_BUCKET,
          fieldValues: fieldValues ? (fieldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
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
          signedPdfUrl: storagePath,
          storageBucket: STORAGE_BUCKET,
          fieldValues: fieldValues ? (fieldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
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

    return NextResponse.json({
      success: true,
      storagePath,
      completion,
    })
  } catch (error: any) {
    console.error('Error uploading filled PDF:', error)
    return NextResponse.json(
      { error: 'Failed to upload filled PDF' },
      { status: 500 }
    )
  }
}

