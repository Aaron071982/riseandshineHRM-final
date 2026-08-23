import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import {
  downloadRequirementDocument,
  isStoredRequirementPath,
  requirementDownloadFileName,
} from '@/lib/crm/requirementDocuments'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; requirementId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, requirementId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    await assertCanViewClient({ ...user, crmRoles }, clientId)

    const requirement = await prisma.clientRequirement.findFirst({
      where: {
        id: requirementId,
        serviceClientId: clientId,
        deletedAt: null,
      },
      select: {
        id: true,
        key: true,
        label: true,
        fileUrl: true,
        fileName: true,
        fileContentType: true,
      },
    })
    if (!requirement) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (!isStoredRequirementPath(requirement.fileUrl)) {
      return NextResponse.json({ error: 'No uploaded file for this requirement' }, { status: 404 })
    }

    const { bytes, contentType } = await downloadRequirementDocument(requirement.fileUrl)
    const downloadName = requirementDownloadFileName({
      fileName: requirement.fileName,
      fileUrl: requirement.fileUrl,
      label: requirement.label,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `REQUIREMENT_DOCUMENT_DOWNLOAD:${requirement.key}`,
      ip: getClientIpFromRequest(request),
    })

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': requirement.fileContentType || contentType,
        'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
        'Content-Length': bytes.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-requirements] download', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    )
  }
}
