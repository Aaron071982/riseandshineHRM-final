import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// GET: Retrieve all documents for an RBT
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    let documents: Array<{ id: string; rbtProfileId: string; fileName: string; fileType: string; documentType: string | null; uploadedAt: Date; fileData?: string; filePath?: string | null }>
    try {
      documents = await prisma.rBTDocument.findMany({
        where: { rbtProfileId: id },
        orderBy: { uploadedAt: 'desc' },
      })
    } catch (err) {
      console.error('Error fetching documents (Prisma), trying raw SQL', err)
      try {
        const rows = await prisma.$queryRaw<
          Array<{ id: string; rbtProfileId: string; fileName: string; fileType: string; documentType: string | null; uploadedAt: Date }>
        >`
          SELECT id, "rbtProfileId", "fileName", "fileType", "documentType", "uploadedAt"
          FROM rbt_documents WHERE "rbtProfileId" = ${id} ORDER BY "uploadedAt" DESC
        `
        documents = rows || []
      } catch (rawErr) {
        console.error('Error fetching documents (raw)', rawErr)
        return NextResponse.json(
          { error: 'Failed to fetch documents' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(documents)
  } catch (error: any) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST: Upload documents for an RBT
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // Verify RBT profile exists
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('documents') as File[]
    const documentTypes = formData.getAll('documentTypes') as string[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const createdDocuments = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const documentType = documentTypes[i] || 'OTHER'

      // Convert file to base64
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const fileBase64 = fileBuffer.toString('base64')
      const fileMimeType = file.type || 'application/octet-stream'

      const document = await prisma.rBTDocument.create({
        data: {
          rbtProfileId: id,
          fileName: file.name,
          fileType: fileMimeType,
          fileData: fileBase64,
          documentType: documentType,
        },
      })

      createdDocuments.push({
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        uploadedAt: document.uploadedAt,
      })
    }

    return NextResponse.json({
      success: true,
      documents: createdDocuments,
      message: `Successfully uploaded ${createdDocuments.length} document(s)`,
    })
  } catch (error: any) {
    console.error('Error uploading documents:', error)
    return NextResponse.json(
      { error: 'Failed to upload documents' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a specific document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    await prisma.rBTDocument.delete({
      where: { id: documentId },
    })

    return NextResponse.json({ success: true, message: 'Document deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}

