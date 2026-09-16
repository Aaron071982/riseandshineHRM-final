import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanAccessPayStatement } from '@/lib/payroll/payStubAccess'
import {
  createPayStubSignedUrl,
  downloadPayStubPdf,
  isPayStubStoragePath,
} from '@/lib/payroll/payStubStorage'
import { payStubDownloadFilename } from '@/lib/payroll/payStubHtml'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Secure pay stub download (financial PII).
 * App-layer ownership: billing manager OR owning BCBA (SENT only).
 * Default: streams PDF with Content-Disposition attachment (no public URL).
 * ?mode=signed → JSON { url, filename, expiresIn } short-lived signed URL.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const user = token ? await validateSession(token) : null

  const access = await assertCanAccessPayStatement({
    user,
    statementId: id,
    requireSentForOwner: true,
  })
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    )
  }

  const statement = await prisma.payStatement.findUnique({
    where: { id },
    include: {
      payPeriod: { select: { payDate: true } },
      contractor: { select: { legalName: true } },
      rbtProfile: { select: { firstName: true, lastName: true } },
    },
  })
  if (!statement?.pdfUrl || !isPayStubStoragePath(statement.pdfUrl)) {
    return NextResponse.json(
      { error: 'Pay stub PDF not available' },
      { status: 404 }
    )
  }

  if (access.role === 'owner' && statement.status !== 'SENT') {
    return NextResponse.json(
      { error: 'Statement not published' },
      { status: 403 }
    )
  }

  const legalName =
    statement.contractor?.legalName ??
    (statement.rbtProfile
      ? `${statement.rbtProfile.firstName} ${statement.rbtProfile.lastName}`
      : 'Payee')
  const filename = payStubDownloadFilename(
    legalName,
    statement.payPeriod.payDate
  )

  const mode = req.nextUrl.searchParams.get('mode')
  if (mode === 'signed') {
    const ttlSeconds = 120
    try {
      const url = await createPayStubSignedUrl(statement.pdfUrl, ttlSeconds)
      return NextResponse.json({ url, filename, expiresIn: ttlSeconds })
    } catch (err) {
      console.error('[payroll-stub] signed url', err)
      return NextResponse.json(
        { error: 'Could not create download link' },
        { status: 500 }
      )
    }
  }

  try {
    const bytes = await downloadPayStubPdf(statement.pdfUrl)
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[payroll-stub] stream', err)
    return NextResponse.json(
      { error: 'Pay stub file not found' },
      { status: 404 }
    )
  }
}
