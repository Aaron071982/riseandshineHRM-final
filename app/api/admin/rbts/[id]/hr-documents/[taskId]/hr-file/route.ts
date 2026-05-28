import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id: rbtProfileId, taskId } = await params
  const task = await prisma.hRDocumentTask.findFirst({
    where: { id: taskId, rbtProfileId },
  })

  if (!task?.hrFileUrl) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const path = task.hrFileUrl.trim()
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return NextResponse.redirect(path)
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(path)
  if (error || !data) {
    console.error('[admin hr-file]', error)
    return NextResponse.json({ error: 'Failed to download' }, { status: 500 })
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  const filename = path.split('/').pop() || 'document.pdf'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
