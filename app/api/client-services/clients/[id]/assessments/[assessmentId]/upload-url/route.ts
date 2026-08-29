import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanUploadTreatmentAssessmentFiles } from '@/lib/crm/assessment/access'
import {
  createAssessmentSignedUpload,
  MAX_ASSESSMENT_FILE_BYTES,
  parseAssessmentAttachmentKind,
  validateAssessmentFile,
} from '@/lib/crm/assessment/storage'
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
    assertCanUploadTreatmentAssessmentFiles(subject)
    await assertCanViewClient(subject, clientId)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: {
        id: assessmentId,
        serviceClientId: clientId,
        deletedAt: null,
        status: { not: 'SIGNED' },
      },
      select: { id: true },
    })
    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found or not editable' },
        { status: 404 }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const sectionKey = String(body.sectionKey ?? '').trim()
    const kind = parseAssessmentAttachmentKind(String(body.kind ?? ''))
    const fileName = String(body.fileName ?? '').trim()
    const contentType = String(body.contentType ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes)

    if (!sectionKey) {
      return NextResponse.json({ error: 'sectionKey is required' }, { status: 400 })
    }
    if (!kind) {
      return NextResponse.json({ error: 'kind must be IMAGE or PDF' }, { status: 400 })
    }
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }

    const check = validateAssessmentFile({
      kind,
      name: fileName,
      size: sizeBytes,
      type: contentType,
    })
    if (!check.ok) {
      const status = sizeBytes > MAX_ASSESSMENT_FILE_BYTES ? 413 : 400
      return NextResponse.json({ error: check.error }, { status })
    }

    const signed = await createAssessmentSignedUpload({
      serviceClientId: clientId,
      assessmentId,
      sectionKey,
      fileName,
      contentType,
      kind,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `TREATMENT_ASSESSMENT_UPLOAD_URL:${sectionKey}`,
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
    console.error('[treatment-assessment] upload-url', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not prepare upload' },
      { status: 500 }
    )
  }
}
