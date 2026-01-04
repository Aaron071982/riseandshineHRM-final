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
    const { documentId, typedName, signatureData, readConfirmed, agreeConfirmed } = body

    if (!documentId || !typedName || !readConfirmed || !agreeConfirmed) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify document exists and is an acknowledgment type
    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (document.type !== 'ACKNOWLEDGMENT') {
      return NextResponse.json(
        { error: 'Document is not an acknowledgment type' },
        { status: 400 }
      )
    }

    // Get client IP and user agent
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create acknowledgment JSON record
    const acknowledgmentJson = {
      typedName,
      signatureData, // base64 image if drawn signature, or typed signature text
      readConfirmed,
      agreeConfirmed,
      timestamp: new Date().toISOString(),
      ip: clientIp,
      userAgent,
    }

    // Create or update completion record
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
        acknowledgmentJson: acknowledgmentJson as any,
      },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId: documentId,
        status: 'COMPLETED',
        completedAt: new Date(),
        acknowledgmentJson: acknowledgmentJson as any,
      },
    })

    return NextResponse.json({ success: true, completion })
  } catch (error: any) {
    console.error('Error saving acknowledgment:', error)
    return NextResponse.json(
      { error: 'Failed to save acknowledgment' },
      { status: 500 }
    )
  }
}

