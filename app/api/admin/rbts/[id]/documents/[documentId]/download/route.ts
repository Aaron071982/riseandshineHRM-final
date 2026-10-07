import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { storageBucketForRbtDocumentPath } from '@/lib/rbtDocumentsSync'
import { buildContentDisposition } from '@/lib/http/contentDisposition'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
}

/** Browsers only render inline when the stored type is specific; fall back to the extension. */
function resolveContentType(fileType: string | null, fileName: string): string {
  const stored = (fileType || '').trim().toLowerCase()
  if (stored && stored !== 'application/octet-stream' && stored.includes('/')) return stored
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? (stored || 'application/octet-stream')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id: rbtProfileId, documentId } = await params
    const wantInline =
      request.nextUrl.searchParams.get('inline') === '1' ||
      request.nextUrl.searchParams.get('preview') === '1'

    const document = await prisma.rBTDocument.findFirst({
      where: { id: documentId, rbtProfileId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    let fileBuffer: Buffer
    if (document.filePath && supabaseAdmin) {
      const path = document.filePath.trim()
      const { data, error } = await supabaseAdmin.storage
        .from(storageBucketForRbtDocumentPath(path))
        .download(path)
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
        'Content-Type': resolveContentType(document.fileType, document.fileName),
        'Content-Disposition': buildContentDisposition(
          wantInline ? 'inline' : 'attachment',
          document.fileName
        ),
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: unknown) {
    console.error('Error downloading document:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}
