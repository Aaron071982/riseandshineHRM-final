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
import { buildAssembledClinicalAssessmentPdf } from '@/lib/crm/clinicalAssessment/assembledDownload'
import { mapAssessmentDetailsRow } from '@/lib/crm/clinicalAssessment/details.shared'
import { buildContentDisposition } from '@/lib/http/contentDisposition'
import { prisma } from '@/lib/prisma'
import { NOT_DELETED } from '@/lib/crm/softDelete'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string; assessmentId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, assessmentId } = await context.params

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

    const assessment = await prisma.clientClinicalAssessment.findFirst({
      where: { id: assessmentId, serviceClientId: clientId },
      include: {
        artifacts: { where: { deletedAt: null } },
        details: true,
      },
    })
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    const bytes = await buildAssembledClinicalAssessmentPdf({
      clientCode: client.clientCode,
      versionNumber: assessment.versionNumber,
      details: assessment.details
        ? mapAssessmentDetailsRow(assessment.details)
        : null,
      artifacts: assessment.artifacts.map((a) => ({
        artifactType: a.artifactType,
        storagePath: a.storagePath,
        contentType: a.contentType,
      })),
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `ASSESSMENT_ASSEMBLED_DOWNLOAD:v${assessment.versionNumber}`,
      ip: getClientIpFromRequest(request),
    })

    const wantInline = request.nextUrl.searchParams.get('inline') === '1'
    const dispositionType = wantInline ? 'inline' : 'attachment'
    const fileName = `Clinical_Assessment_v${assessment.versionNumber}_${client.clientCode}.pdf`

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': buildContentDisposition(dispositionType, fileName),
        'Content-Length': bytes.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-clinical-assessment] assembled download', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    )
  }
}
