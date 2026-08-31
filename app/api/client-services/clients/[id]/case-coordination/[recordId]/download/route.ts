import { NextRequest, NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanViewCaseCoordination } from '@/lib/crm/caseCoordination/access'
import { auditCaseCoordinationAction } from '@/lib/crm/caseCoordination/audit'
import { downloadCaseCoordinationPdf } from '@/lib/crm/caseCoordination/storage'
import { buildContentDisposition } from '@/lib/http/contentDisposition'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; recordId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, recordId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanViewCaseCoordination(subject)
    await assertCanViewClient(subject, clientId)

    const record = await prisma.clientCaseCoordination.findFirst({
      where: {
        id: recordId,
        serviceClientId: clientId,
        deletedAt: null,
      },
      include: {
        serviceClient: { select: { clientCode: true, firstName: true, lastName: true } },
      },
    })
    if (!record?.pdfPath) {
      return NextResponse.json(
        { error: 'No saved PDF for this record. Confirm the form to generate one.' },
        { status: 404 }
      )
    }

    const { bytes, contentType } = await downloadCaseCoordinationPdf(record.pdfPath)
    const code = record.serviceClient.clientCode?.trim() || 'client'
    const fileName = `${code}-case-coordination.pdf`
    const inline = request.nextUrl.searchParams.get('inline') === '1'

    await auditCaseCoordinationAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'PDF_DOWNLOAD',
      ip: getClientIpFromRequest(request),
    })

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
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
    console.error('[case-coordination] download', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    )
  }
}
