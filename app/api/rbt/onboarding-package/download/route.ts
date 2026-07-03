import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { requireRbtSession, validateSession, isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function buildOnboardingZip(rbtProfileId: string): Promise<{ zip: Buffer; folderName: string } | null> {
  const rbt = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { firstName: true, lastName: true },
  })
  if (!rbt) return null

  const [completions, folders] = await Promise.all([
    prisma.onboardingCompletion.findMany({
      where: { rbtProfileId, status: 'COMPLETED' },
      include: { document: true, signatureCertificate: true },
    }),
    prisma.employeeDocumentFolder.findMany({ where: { rbtProfileId } }),
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
      const { data } = await supabaseAdmin.storage
        .from(c.storageBucket ?? STORAGE_BUCKET)
        .download(c.signedPdfUrl)
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
  return { zip, folderName }
}

async function logOnboardingDownload(params: {
  userId: string
  rbtProfileId: string
  request: NextRequest
  role: string
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        activityType: 'FORM_SUBMISSION',
        action: 'Downloaded onboarding package',
        resourceType: 'rbt_profile',
        resourceId: params.rbtProfileId,
        url: '/api/rbt/onboarding-package/download',
        ipAddress: getClientIpFromRequest(params.request),
        userAgent: params.request.headers.get('user-agent'),
        metadata: {
          rbtProfileId: params.rbtProfileId,
          accessorRole: params.role,
          phiAccess: true,
        },
      },
    })
  } catch (error) {
    console.error('[onboarding-package/download] activity log failed', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestedRbtProfileId = request.nextUrl.searchParams.get('rbtProfileId')
    let rbtProfileId: string | null = null

    if (requestedRbtProfileId) {
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      rbtProfileId = requestedRbtProfileId
    } else if ((user.role ?? '').toUpperCase() === 'RBT' || (user.role ?? '').toUpperCase() === 'CANDIDATE') {
      const rbtAuth = await requireRbtSession()
      if (rbtAuth.response) return rbtAuth.response
      rbtProfileId = rbtAuth.user.rbtProfileId ?? null
    } else if (isAdmin(user)) {
      return NextResponse.json(
        { error: 'Admin downloads require rbtProfileId query parameter' },
        { status: 400 }
      )
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await buildOnboardingZip(rbtProfileId)
    if (!result) {
      return NextResponse.json({ error: 'Onboarding package not found' }, { status: 404 })
    }

    await logOnboardingDownload({
      userId: user.id,
      rbtProfileId,
      request,
      role: user.role,
    })

    return new NextResponse(new Uint8Array(result.zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.folderName}_onboarding.zip"`,
        'Content-Length': result.zip.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[onboarding-package/download]', error)
    return NextResponse.json({ error: 'Failed to create onboarding package' }, { status: 500 })
  }
}
