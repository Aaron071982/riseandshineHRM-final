import { NextRequest, NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanViewClient,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanViewTreatmentAssessment } from '@/lib/crm/assessment/access'
import { downloadAssessmentFile } from '@/lib/crm/assessment/storage'
import { UPLOADED_PDF_SECTION_KEY } from '@/lib/crm/assessment/storagePaths'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; assessmentId: string }> }

/** Download: UPLOAD source returns original PDF; FORM redirects client to print route. */
export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, assessmentId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanViewTreatmentAssessment(subject)
    await assertCanViewClient(subject, clientId)

    const assessment = await prisma.clientTreatmentAssessment.findFirst({
      where: { id: assessmentId, serviceClientId: clientId, deletedAt: null },
      include: {
        attachments: {
          where: { deletedAt: null, sectionKey: UPLOADED_PDF_SECTION_KEY, kind: 'PDF' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (assessment.source === 'UPLOAD') {
      const pdf = assessment.attachments[0]
      if (!pdf) {
        return NextResponse.json({ error: 'Uploaded PDF not found' }, { status: 404 })
      }
      const { bytes, contentType } = await downloadAssessmentFile(pdf.storagePath)
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${pdf.fileName.replace(/"/g, '')}"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    const printUrl = new URL(
      `/client-services/clients/${clientId}/assessments/${assessmentId}/print`,
      request.nextUrl.origin
    )
    printUrl.searchParams.set('auto', '1')
    return NextResponse.redirect(printUrl)
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
