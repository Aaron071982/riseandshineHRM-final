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
import { auditTreatmentAssessmentAction } from '@/lib/crm/assessment/audit'
import {
  createAssessmentAttachmentRecord,
  parseAssessmentAttachmentKind,
} from '@/lib/crm/assessment/storage'
import { UPLOADED_PDF_SECTION_KEY } from '@/lib/crm/assessment/storagePaths'
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

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const sectionKey = String(body.sectionKey ?? '').trim()
    const kind = parseAssessmentAttachmentKind(String(body.kind ?? ''))
    const storagePath = String(body.storagePath ?? '').trim()
    const fileName = String(body.fileName ?? '').trim()
    const mimeType = String(body.mimeType ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes)

    if (!sectionKey || !kind || !storagePath || !fileName || !sizeBytes) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (sectionKey === UPLOADED_PDF_SECTION_KEY && kind === 'PDF') {
      await prisma.clientTreatmentAssessmentAttachment.updateMany({
        where: {
          assessmentId,
          sectionKey: UPLOADED_PDF_SECTION_KEY,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      })
    }

    const record = await createAssessmentAttachmentRecord({
      assessmentId,
      serviceClientId: clientId,
      userId: user.id,
      sectionKey,
      kind,
      storagePath,
      fileName,
      mimeType,
      sizeBytes,
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: clientId,
      assessmentId,
      action: 'ATTACHMENT_UPLOADED',
      detail: sectionKey,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `TREATMENT_ASSESSMENT_ATTACHED:${sectionKey}`,
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({
      attachmentId: record.id,
      storagePath: record.storagePath,
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[treatment-assessment] attach', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not attach file' },
      { status: 500 }
    )
  }
}
