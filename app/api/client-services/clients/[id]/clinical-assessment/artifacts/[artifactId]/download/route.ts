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
import { assertCanViewClinicalAssessment } from '@/lib/crm/clinicalAssessment/access'
import { artifactDownloadLabel } from '@/lib/crm/clinicalAssessment/artifacts.shared'
import { wrapClinicalAssessmentDownload } from '@/lib/crm/clinicalAssessment/brandedDownload'
import { downloadClinicalAssessmentArtifact } from '@/lib/crm/clinicalAssessment/storage'
import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; artifactId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, artifactId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanViewClinicalAssessment(subject)
    await assertCanViewClient(subject, clientId)

    const client = await prisma.serviceClient.findFirst({
      where: { id: clientId, ...NOT_DELETED, ...getVisibleClientsWhere(subject) },
      select: { id: true, clientCode: true },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const artifact = await prisma.clientClinicalAssessmentArtifact.findFirst({
      where: {
        id: artifactId,
        deletedAt: null,
        assessment: { serviceClientId: clientId },
      },
      include: {
        assessment: {
          select: { versionNumber: true, lockState: true },
        },
      },
    })
    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    const { bytes, contentType } = await downloadClinicalAssessmentArtifact(
      artifact.storagePath
    )

    const wantInline =
      request.nextUrl.searchParams.get('inline') === '1' ||
      request.nextUrl.searchParams.get('preview') === '1'
    const branded =
      request.nextUrl.searchParams.get('branded') !== '0' &&
      (wantInline || request.nextUrl.searchParams.get('branded') === '1')

    const wrapped = await wrapClinicalAssessmentDownload({
      bytes,
      contentType: artifact.contentType || contentType,
      artifactType: artifact.artifactType,
      clientCode: client.clientCode,
      versionNumber: artifact.assessment.versionNumber,
      branded: branded || wantInline,
    })

    const downloadName = `${artifactDownloadLabel(artifact.artifactType)}_v${artifact.assessment.versionNumber}.pdf`
    const disposition = wantInline ? 'inline' : 'attachment'

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `ASSESSMENT_ARTIFACT_${wantInline ? 'PREVIEW' : 'DOWNLOAD'}:${artifact.artifactType}`,
      ip: getClientIpFromRequest(request),
    })

    return new NextResponse(new Uint8Array(wrapped.bytes), {
      headers: {
        'Content-Type': wrapped.contentType,
        'Content-Disposition': `${disposition}; filename="${downloadName.replace(/"/g, '')}"`,
        'Content-Length': wrapped.bytes.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-clinical-assessment] download', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    )
  }
}
