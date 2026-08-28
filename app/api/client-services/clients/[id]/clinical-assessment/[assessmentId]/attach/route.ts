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
  attachClinicalAssessmentArtifactRecord,
  MAX_CLINICAL_ASSESSMENT_BYTES,
  parseAssessmentArtifactType,
  validateClinicalAssessmentFile,
} from '@/lib/crm/clinicalAssessment/storage'

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

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const artifactType = parseAssessmentArtifactType(String(body.artifactType ?? ''))
    const storagePath = String(body.storagePath ?? '').trim()
    const fileName = String(body.fileName ?? '').trim()
    const contentType = String(body.contentType ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes)

    if (!artifactType) {
      return NextResponse.json({ error: 'artifactType is required' }, { status: 400 })
    }
    if (!storagePath || !fileName) {
      return NextResponse.json(
        { error: 'storagePath and fileName are required' },
        { status: 400 }
      )
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

    const artifact = await attachClinicalAssessmentArtifactRecord({
      assessmentId,
      clientId,
      userId: user.id,
      artifactType,
      storagePath,
      fileName,
      contentType,
      sizeBytes,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `ASSESSMENT_ARTIFACT_UPLOAD:${artifactType}`,
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({ artifact })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-clinical-assessment] attach', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not attach file' },
      { status: 500 }
    )
  }
}
