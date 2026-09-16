import { notFound } from 'next/navigation'
import { AssessmentFormClient } from '@/components/crm/assessment/AssessmentFormClient'
import { loadTreatmentAssessmentDetail } from '@/lib/crm/assessment/load'
import { parseAssessmentRecord } from '@/lib/crm/assessment/serialize'
import { prisma } from '@/lib/prisma'
import {
  getClientServicesUser,
  assertCanViewClient,
  getVisibleClientsWhere,
} from '@/lib/crm/access'
import { assertCanViewTreatmentAssessment } from '@/lib/crm/assessment/access'
import { isClinicalSurfaceOnly } from '@/lib/crm/bcbaPortal'
import { redirect } from 'next/navigation'

type Props = { params: Promise<{ clientId: string; assessmentId: string }> }

export default async function PortalAssessmentFormPage({ params }: Props) {
  const { clientId, assessmentId } = await params
  const user = await getClientServicesUser()
  if (!isClinicalSurfaceOnly(user)) redirect('/client-services')

  assertCanViewTreatmentAssessment(user)
  await assertCanViewClient(user, clientId)

  const detail = await loadTreatmentAssessmentDetail(clientId, assessmentId)
  if (!detail) notFound()

  const client = await prisma.serviceClient.findFirst({
    where: { id: clientId, ...getVisibleClientsWhere(user) },
    select: { firstName: true, lastName: true },
  })
  if (!client) notFound()

  const { assessment, permissions } = detail
  if (assessment.source === 'UPLOAD') {
    notFound()
  }

  const sections = parseAssessmentRecord(assessment)

  return (
    <AssessmentFormClient
      clientId={clientId}
      clientName={`${client.firstName} ${client.lastName}`}
      assessmentId={assessment.id}
      status={assessment.status}
      source={assessment.source}
      initialSections={sections}
      initialUpdatedAt={assessment.updatedAt.toISOString()}
      attachments={assessment.attachments.map((a) => ({
        id: a.id,
        sectionKey: a.sectionKey,
        fileName: a.fileName,
        mimeType: a.mimeType,
      }))}
      canEdit={permissions.canEdit}
      basePath="/portal"
    />
  )
}
