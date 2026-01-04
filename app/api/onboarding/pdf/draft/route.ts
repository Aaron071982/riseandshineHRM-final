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
    const { documentId, formData } = body

    if (!documentId || !formData) {
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

    // Create or update completion record with draft data
    const completion = await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: {
          rbtProfileId: user.rbtProfileId,
          documentId: documentId,
        },
      },
      update: {
        status: 'IN_PROGRESS',
        draftData: formData as any,
      },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId: documentId,
        status: 'IN_PROGRESS',
        draftData: formData as any,
      },
    })

    return NextResponse.json({ success: true, completion })
  } catch (error: any) {
    console.error('Error saving draft:', error)
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    )
  }
}

