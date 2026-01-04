import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const documents = await prisma.onboardingDocument.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ documents })
  } catch (error: any) {
    console.error('Error fetching onboarding documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const documentId = formData.get('documentId') as string
    const file = formData.get('file') as File

    if (!documentId || !file) {
      return NextResponse.json(
        { error: 'Document ID and file are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileBase64 = fileBuffer.toString('base64')

    // Update the document with PDF data
    const document = await prisma.onboardingDocument.update({
      where: { id: documentId },
      data: {
        pdfData: fileBase64,
      },
    })

    return NextResponse.json({ success: true, document })
  } catch (error: any) {
    console.error('Error uploading PDF:', error)
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    )
  }
}

