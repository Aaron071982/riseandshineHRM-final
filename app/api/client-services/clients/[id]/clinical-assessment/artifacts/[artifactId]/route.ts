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
import { softDeleteClinicalAssessmentArtifact } from '@/lib/crm/clinicalAssessment/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; artifactId: string }> }

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, artifactId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanUploadClinicalAssessmentArtifacts(subject)
    await assertCanViewClient(subject, clientId)

    const artifact = await softDeleteClinicalAssessmentArtifact({
      artifactId,
      clientId,
      userId: user.id,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `CLINICAL_ASSESSMENT_ARTIFACT_DELETED:${artifact.artifactType}`,
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Delete failed'
    const status =
      /not found|locked/i.test(message) ? 404 : 500
    if (status === 500) {
      console.error('[clinical-assessment] delete artifact', err)
    }
    return NextResponse.json({ error: message }, { status })
  }
}
