import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

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

    const body = await request.json()
    const { documentId, completedPdfData } = body

    if (!documentId || !completedPdfData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify document exists and is a fillable PDF type
    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (document.type !== 'FILLABLE_PDF') {
      return NextResponse.json(
        { error: 'Document is not a fillable PDF type' },
        { status: 400 }
      )
    }

    // Store the completed PDF (base64 encoded)
    // In a production system, you might want to upload this to S3/Supabase Storage
    // For now, we'll store it as base64 in the database
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
        signedPdfData: completedPdfData, // base64 encoded PDF
      },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId: documentId,
        status: 'COMPLETED',
        completedAt: new Date(),
        signedPdfData: completedPdfData,
      },
    })

    return NextResponse.json({ success: true, completion })
  } catch (error: any) {
    console.error('Error finalizing PDF:', error)
    return NextResponse.json(
      { error: 'Failed to finalize PDF' },
      { status: 500 }
    )
  }
}

