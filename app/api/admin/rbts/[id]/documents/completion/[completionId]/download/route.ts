import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; completionId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id: rbtProfileId, completionId } = await params

    const completion = await prisma.onboardingCompletion.findUnique({
      where: { id: completionId },
      include: { document: true },
    })
    if (
      !completion ||
      completion.rbtProfileId !== rbtProfileId ||
      !completion.signedPdfUrl
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 500 }
      )
    }

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(completion.signedPdfUrl)
    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      )
    }
    const buf = Buffer.from(await data.arrayBuffer())
    const fileName = `${completion.document.title.replace(/\W+/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buf.length.toString(),
      },
    })
  } catch (error) {
    console.error('[admin/rbts/documents/completion/download] error:', error)
    return NextResponse.json(
      { error: 'Failed to download' },
      { status: 500 }
    )
  }
}
