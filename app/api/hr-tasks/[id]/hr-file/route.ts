import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

/** GET: download HR-prepared file for an HR document task (storage path in hrFileUrl). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    const hrTask = await prisma.hRDocumentTask.findUnique({ where: { id } })

    if (!hrTask || hrTask.rbtProfileId !== user.rbtProfileId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const path = hrTask.hrFileUrl?.trim()
    if (!path) {
      return NextResponse.json({ error: 'HR file not available' }, { status: 404 })
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return NextResponse.redirect(path)
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(path)
    if (error || !data) {
      console.error('hr-file download error:', error)
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const filename = path.split('/').pop() || 'document.pdf'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('hr-tasks hr-file error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
