import { NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanUploadTreatmentAssessmentFiles } from '@/lib/crm/assessment/access'
import { auditTreatmentAssessmentAction } from '@/lib/crm/assessment/audit'
import { softDeleteAssessmentAttachment } from '@/lib/crm/assessment/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; attachmentId: string }> }

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, attachmentId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanUploadTreatmentAssessmentFiles(subject)
    await assertCanViewClient(subject, clientId)

    const attachment = await prisma.clientTreatmentAssessmentAttachment.findFirst({
      where: {
        id: attachmentId,
        deletedAt: null,
        assessment: { serviceClientId: clientId, deletedAt: null },
      },
      select: {
        id: true,
        fileName: true,
        assessmentId: true,
        assessment: { select: { status: true } },
      },
    })
    if (!attachment) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    if (attachment.assessment.status === 'SIGNED') {
      return NextResponse.json(
        { error: 'Signed assessments cannot be modified' },
        { status: 400 }
      )
    }

    await softDeleteAssessmentAttachment({
      attachmentId: attachment.id,
      assessmentId: attachment.assessmentId,
      serviceClientId: clientId,
      userId: user.id,
    })

    await auditTreatmentAssessmentAction({
      userId: user.id,
      serviceClientId: clientId,
      assessmentId: attachment.assessmentId,
      action: 'ATTACHMENT_DELETED',
      detail: attachment.fileName,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[treatment-assessment] delete attachment', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    )
  }
}
