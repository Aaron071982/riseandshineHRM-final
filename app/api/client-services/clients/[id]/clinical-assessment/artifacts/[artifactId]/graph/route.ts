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
import { isGraphArtifactType } from '@/lib/crm/clinicalAssessment/assembledDownload'
import { createClinicalAssessmentGraphSignedUrl } from '@/lib/crm/clinicalAssessment/storage'
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
      select: { id: true },
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
      select: {
        id: true,
        artifactType: true,
        storagePath: true,
        contentType: true,
      },
    })
    if (!artifact || !isGraphArtifactType(artifact.artifactType)) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 })
    }

    const signedUrl = await createClinicalAssessmentGraphSignedUrl(
      artifact.storagePath,
      60
    )

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `ASSESSMENT_GRAPH_VIEW:${artifact.artifactType}`,
      ip: getClientIpFromRequest(request),
    })

    const wantsJson = request.nextUrl.searchParams.get('format') === 'json'
    if (wantsJson) {
      return NextResponse.json({
        signedUrl,
        contentType: artifact.contentType,
        artifactType: artifact.artifactType,
      })
    }

    return NextResponse.redirect(signedUrl, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-clinical-assessment] graph', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Graph unavailable' },
      { status: 500 }
    )
  }
}
