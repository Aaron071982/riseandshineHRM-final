import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
  getVisibleClientsWhere,
} from '@/lib/crm/access'
import {
  assertCanDownloadClientDocuments,
} from '@/lib/crm/billingAccess'
import {
  authTemplateDownloadFileName,
  downloadAuthTemplateDocument,
} from '@/lib/crm/authorizationTemplate'
import { buildContentDisposition } from '@/lib/http/contentDisposition'
import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    await assertCanViewClient(subject, clientId)

    const client = await prisma.serviceClient.findFirst({
      where: { id: clientId, ...NOT_DELETED, ...getVisibleClientsWhere(subject) },
      select: { id: true, stage: true },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    assertCanDownloadClientDocuments(subject, client.stage)

    const template = await prisma.clientAuthorizationTemplate.findFirst({
      where: { serviceClientId: clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        contentType: true,
      },
    })
    if (!template) {
      return NextResponse.json({ error: 'No template on file' }, { status: 404 })
    }

    const { bytes, contentType } = await downloadAuthTemplateDocument(
      template.storagePath
    )
    const downloadName = authTemplateDownloadFileName({
      fileName: template.fileName,
      storagePath: template.storagePath,
    })

    const wantInline =
      request.nextUrl.searchParams.get('inline') === '1' ||
      request.nextUrl.searchParams.get('preview') === '1'
    const dispositionType = wantInline ? 'inline' : 'attachment'

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `AUTH_TEMPLATE_${wantInline ? 'PREVIEW' : 'DOWNLOAD'}`,
      ip: getClientIpFromRequest(request),
    })

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': template.contentType || contentType,
        'Content-Disposition': buildContentDisposition(dispositionType, downloadName),
        'Content-Length': bytes.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-auth-template] download', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    )
  }
}
