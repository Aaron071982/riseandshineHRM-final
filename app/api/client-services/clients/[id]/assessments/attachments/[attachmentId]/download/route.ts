import { NextRequest, NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanViewTreatmentAssessment } from '@/lib/crm/assessment/access'
import { downloadAssessmentFile } from '@/lib/crm/assessment/storage'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, attachmentId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanViewTreatmentAssessment(subject)
    await assertCanViewClient(subject, clientId)

    const attachment = await prisma.clientTreatmentAssessmentAttachment.findFirst({
      where: {
        id: attachmentId,
        deletedAt: null,
        assessment: { serviceClientId: clientId, deletedAt: null },
      },
    })
    if (!attachment) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const { bytes, contentType } = await downloadAssessmentFile(attachment.storagePath)
    const download = request.nextUrl.searchParams.get('download') === '1'
    const disposition = download
      ? `attachment; filename="${attachment.fileName.replace(/"/g, '')}"`
      : 'inline'

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[treatment-assessment] download', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    )
  }
}
