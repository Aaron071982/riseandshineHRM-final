import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

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

    const formData = await request.formData()
    const documentId = formData.get('documentId') as string
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
    const storagePath = `rbts/${user.rbtProfileId}/${documentId}/${document.slug}-${timestamp}.pdf`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
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

    // Store the storage path in signedPdfUrl (per schema design)
    // Update or create OnboardingCompletion record
    const completion = await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: {
          rbtProfileId: user.rbtProfileId,
          documentId: documentId,
        },
      },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
        signedPdfUrl: storagePath, // Store the storage path in signedPdfUrl field
        storageBucket: STORAGE_BUCKET,
        fieldValues: fieldValues ? (fieldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        // Clear draft data now that it's finalized
        draftData: Prisma.JsonNull,
      },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId: documentId,
        status: 'COMPLETED',
        completedAt: new Date(),
        signedPdfUrl: storagePath, // Store the storage path in signedPdfUrl field
        storageBucket: STORAGE_BUCKET,
        fieldValues: fieldValues ? (fieldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
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

