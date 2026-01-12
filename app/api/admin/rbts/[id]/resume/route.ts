import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { supabaseAdmin, RESUMES_STORAGE_BUCKET } from '@/lib/supabase'

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

    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    if (!rbtProfile.resumeUrl) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      )
    }

    // Download from Supabase Storage
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase Storage not configured' },
        { status: 500 }
      )
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(RESUMES_STORAGE_BUCKET)
      .download(rbtProfile.resumeUrl)

    if (downloadError) {
      console.error('Supabase Storage download error:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download resume' },
        { status: 500 }
      )
    }

    if (!fileData) {
      return NextResponse.json(
        { error: 'Resume file not found' },
        { status: 404 }
      )
    }

    // Convert Blob to ArrayBuffer then to Buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Get filename from resumeFileName or generate from storage path
    const filename = rbtProfile.resumeFileName || rbtProfile.resumeUrl.split('/').pop() || 'resume.pdf'
    const mimeType = rbtProfile.resumeMimeType || 'application/pdf'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error downloading resume:', error)
    return NextResponse.json(
      { error: 'Failed to download resume' },
      { status: 500 }
    )
  }
}
