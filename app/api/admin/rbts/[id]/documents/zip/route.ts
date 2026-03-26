import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, RESUMES_STORAGE_BUCKET, STORAGE_BUCKET } from '@/lib/supabase'
import archiver from 'archiver'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id: rbtProfileId } = await params

    const profile = await prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { firstName: true, lastName: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'RBT not found' }, { status: 404 })
    }

    const [rbtDocs, completions] = await Promise.all([
      prisma.rBTDocument.findMany({
        where: { rbtProfileId },
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.onboardingCompletion.findMany({
        where: { rbtProfileId, status: 'COMPLETED', signedPdfUrl: { not: null } },
        include: { document: true },
      }),
    ])

    const archive = archiver('zip', { zlib: { level: 9 } })
    const bodyPromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      archive.on('data', (c: Buffer) => chunks.push(c))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    const safeName = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_')

    for (const doc of rbtDocs) {
      let buf: Buffer
      if (doc.filePath && supabaseAdmin) {
        const { data, error } = await supabaseAdmin.storage
          .from(RESUMES_STORAGE_BUCKET)
          .download(doc.filePath)
        if (error || !data) continue
        buf = Buffer.from(await data.arrayBuffer())
      } else {
        buf = Buffer.from(doc.fileData || '', 'base64')
      }
      archive.append(buf, { name: `documents/${safeName(doc.fileName)}` })
    }

    for (const c of completions) {
      if (!c.signedPdfUrl || !supabaseAdmin) continue
      const { data, error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .download(c.signedPdfUrl)
      if (error || !data) continue
      const buf = Buffer.from(await data.arrayBuffer())
      const name = `onboarding/${safeName(c.document.title)}.pdf`
      archive.append(buf, { name })
    }

    archive.finalize()
    const body = await bodyPromise
    const bodyBytes = new Uint8Array(body)

    const filename = `documents-${safeName(profile.firstName)}-${safeName(profile.lastName)}-${Date.now()}.zip`

    return new NextResponse(bodyBytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': bodyBytes.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('[admin/rbts/documents/zip] error:', error)
    return NextResponse.json(
      { error: 'Failed to create zip' },
      { status: 500 }
    )
  }
}
