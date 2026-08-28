import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanUploadClinicalAssessmentArtifacts } from '@/lib/crm/clinicalAssessment/access'
import {
  createClinicalAssessmentSignedUpload,
  MAX_CLINICAL_ASSESSMENT_BYTES,
  parseAssessmentArtifactType,
  validateClinicalAssessmentFile,
} from '@/lib/crm/clinicalAssessment/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; assessmentId: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, assessmentId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanUploadClinicalAssessmentArtifacts(subject)
    await assertCanViewClient(subject, clientId)

    const assessment = await prisma.clientClinicalAssessment.findFirst({
      where: {
        id: assessmentId,
        serviceClientId: clientId,
        lockState: 'DRAFT',
      },
      select: { id: true },
    })
    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found or locked' },
        { status: 404 }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const artifactType = parseAssessmentArtifactType(String(body.artifactType ?? ''))
    const fileName = String(body.fileName ?? '').trim()
    const contentType = String(body.contentType ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes)

    if (!artifactType) {
      return NextResponse.json({ error: 'artifactType is required' }, { status: 400 })
    }
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }

    const check = validateClinicalAssessmentFile({
      artifactType,
      name: fileName,
      size: sizeBytes,
      type: contentType,
    })
    if (!check.ok) {
      const status = sizeBytes > MAX_CLINICAL_ASSESSMENT_BYTES ? 413 : 400
      return NextResponse.json({ error: check.error }, { status })
    }

    const signed = await createClinicalAssessmentSignedUpload({
      clientId,
      assessmentId,
      artifactType,
      fileName,
      contentType,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `ASSESSMENT_ARTIFACT_UPLOAD_URL:${artifactType}`,
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      token: signed.token,
      storagePath: signed.storagePath,
      contentType: signed.contentType,
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-clinical-assessment] upload-url', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not prepare upload' },
      { status: 500 }
    )
  }
}
