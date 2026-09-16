import { notFound, redirect } from 'next/navigation'
import { AssessmentPrintView } from '@/components/crm/assessment/AssessmentPrintView'
import { loadTreatmentAssessmentForPrint } from '@/lib/crm/assessment/load'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'
import { getClientServicesUser, assertCanViewClient } from '@/lib/crm/access'
import { assertCanViewTreatmentAssessment } from '@/lib/crm/assessment/access'
import { createAssessmentFileSignedUrl } from '@/lib/crm/assessment/storage'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'

type Props = { params: Promise<{ clientId: string; assessmentId: string }> }

export default async function PortalAssessmentPrintPage({ params }: Props) {
  const { clientId, assessmentId } = await params
  const user = await getClientServicesUser()
  if (!isClinicalSurfaceOnly(user)) redirect('/client-services')

  assertCanViewTreatmentAssessment(user)
  await assertCanViewClient(user, clientId)

  // loadTreatmentAssessmentForPrint scopes via assertCanViewClient above
  const data = await loadTreatmentAssessmentForPrint(clientId, assessmentId)
  if (!data) notFound()

  const sections = parseAssessmentRecord(data.assessment)

  const attachmentUrls: Record<string, string> = {}
  for (const att of data.assessment.attachments) {
    if (att.mimeType.startsWith('image/')) {
      try {
        attachmentUrls[att.id] = await createAssessmentFileSignedUrl(
          att.storagePath,
          300
        )
      } catch {
        /* skip broken images */
      }
    }
  }

  return (
    <AssessmentPrintView
      clientId={clientId}
      assessmentId={assessmentId}
      client={data.client}
      sections={sections}
      attachments={data.assessment.attachments}
      attachmentUrls={attachmentUrls}
      status={data.assessment.status}
      source={data.assessment.source}
      basePath="/portal"
    />
  )
}
