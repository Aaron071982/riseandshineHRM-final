import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ completionId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await validateSession(sessionToken)
    if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { completionId } = await params
    const completion = await prisma.onboardingCompletion.findUnique({
      where: { id: completionId },
      include: { document: true },
    })
    if (
      !completion ||
      completion.rbtProfileId !== user.rbtProfileId ||
      completion.status !== 'COMPLETED' ||
      !completion.signedPdfUrl
    ) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
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
      console.error('Supabase download error:', error)
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 500 }
      )
    }
    const fileBuffer = Buffer.from(await data.arrayBuffer())
    const fileName = `${completion.document.slug || completion.document.title.replace(/\W+/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[rbt/documents/company] download error:', error)
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    )
  }
}
