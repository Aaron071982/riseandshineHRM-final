import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import archiver from 'archiver'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  const rbt = await prisma.rBTProfile.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  })
  if (!rbt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [completions, folders] = await Promise.all([
    prisma.onboardingCompletion.findMany({
      where: { rbtProfileId: id, status: 'COMPLETED' },
      include: { document: true, signatureCertificate: true },
    }),
    prisma.employeeDocumentFolder.findMany({ where: { rbtProfileId: id } }),
  ])

  const chunks: Buffer[] = []
  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('data', (c: Buffer) => chunks.push(c))

  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
  })

  const folderName = `${rbt.firstName}_${rbt.lastName}`.replace(/\s+/g, '_')

  for (const c of completions) {
    const sub =
      c.document.flowType === 'ESIGN' || c.document.flowType === 'NOTICE'
        ? 'Acknowledgments'
        : c.document.type === 'FILLABLE_PDF'
          ? 'Tax_Forms'
          : 'Documents'
    const base = `${folderName}/${sub}/${c.document.slug}`
    if (c.signedPdfUrl && supabaseAdmin) {
      const { data } = await supabaseAdmin.storage.from(c.storageBucket ?? STORAGE_BUCKET).download(c.signedPdfUrl)
      if (data) {
        const buf = Buffer.from(await data.arrayBuffer())
        archive.append(buf, { name: `${base}.pdf` })
      }
    }
    if (c.signatureCertificate) {
      archive.append(JSON.stringify(c.signatureCertificate.certificateJson, null, 2), {
        name: `${base}_certificate.json`,
      })
    }
  }

  for (const f of folders) {
    if (f.fileUrl.startsWith('quiz-cert:')) continue
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(f.fileUrl)
      if (data) {
        const buf = Buffer.from(await data.arrayBuffer())
        archive.append(buf, { name: `${folderName}/Uploads/${f.fileName}` })
      }
    }
  }

  archive.finalize()
  const zip = await done

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}_onboarding.zip"`,
    },
  })
}
