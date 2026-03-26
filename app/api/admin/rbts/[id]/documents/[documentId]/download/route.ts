import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { supabaseAdmin, RESUMES_STORAGE_BUCKET } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const { documentId } = await params

    const document = await prisma.rBTDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    let fileBuffer: Buffer
    if (document.filePath && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.storage
        .from(RESUMES_STORAGE_BUCKET)
        .download(document.filePath)
      if (error || !data) {
        console.error('Supabase download error:', error)
        return NextResponse.json(
          { error: 'Failed to download file from storage' },
          { status: 500 }
        )
      }
      fileBuffer = Buffer.from(await data.arrayBuffer())
    } else {
      fileBuffer = Buffer.from(document.fileData || '', 'base64')
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': document.fileType,
        'Content-Disposition': `attachment; filename="${document.fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error downloading document:', error)
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    )
  }
}

