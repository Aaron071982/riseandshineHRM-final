import { notFound } from 'next/navigation'
import { AssessmentPrintView } from '@/components/crm/assessment/AssessmentPrintView'
import { loadTreatmentAssessmentForPrint } from '@/lib/crm/assessment/load'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'
import { getClientServicesUser, assertCanViewClient } from '@/lib/crm/access'
import { assertCanViewTreatmentAssessment } from '@/lib/crm/assessment/access'
import { createAssessmentFileSignedUrl } from '@/lib/crm/assessment/storage'

type Props = { params: Promise<{ id: string; assessmentId: string }> }

export default async function AssessmentPrintPage({ params }: Props) {
  const { id: clientId, assessmentId } = await params
  const user = await getClientServicesUser()
  assertCanViewTreatmentAssessment(user)
  await assertCanViewClient(user, clientId)

  const data = await loadTreatmentAssessmentForPrint(clientId, assessmentId)
  if (!data) notFound()

  const sections = parseAssessmentRecord(data.assessment)

  const attachmentUrls: Record<string, string> = {}
  for (const att of data.assessment.attachments) {
    if (att.mimeType.startsWith('image/')) {
      try {
        attachmentUrls[att.id] = await createAssessmentFileSignedUrl(att.storagePath, 300)
      } catch {
        /* skip broken images */
      }
    }
  }

  return (
    <AssessmentPrintView
      client={data.client}
      sections={sections}
      attachments={data.assessment.attachments}
      attachmentUrls={attachmentUrls}
      status={data.assessment.status}
      source={data.assessment.source}
    />
  )
}
