import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { buildContentDisposition } from '@/lib/http/contentDisposition'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; submissionId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, submissionId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    await assertCanViewClient(subject, clientId)

    const submission = await prisma.clientIntakeSubmission.findFirst({
      where: {
        id: submissionId,
        serviceClientId: clientId,
      },
      select: {
        id: true,
        formCode: true,
        formTitle: true,
        filledPdfData: true,
      },
    })
    if (!submission?.filledPdfData) {
      return NextResponse.json({ error: 'Intake form not found' }, { status: 404 })
    }

    let pdfBytes: Buffer
    try {
      pdfBytes = Buffer.from(submission.filledPdfData, 'base64')
      if (pdfBytes.length === 0) throw new Error('empty')
    } catch {
      return NextResponse.json({ error: 'Stored PDF is invalid' }, { status: 500 })
    }

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'VIEW_INTAKE',
      ip: getClientIpFromRequest(request),
    })

    const inline = request.nextUrl.searchParams.get('inline') === '1'
    const fileName = `${submission.formCode}_${submission.formTitle.replace(/\s+/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBytes.length),
        'Content-Disposition': buildContentDisposition(
          inline ? 'inline' : 'attachment',
          fileName
        ),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[intake pdf download]', err)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
