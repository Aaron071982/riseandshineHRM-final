import { auditClientAction } from '@/lib/crm/access'

export type TreatmentAssessmentAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'AUTOSAVED'
  | 'COMPLETED'
  | 'SIGNED'
  | 'ATTACHMENT_UPLOADED'
  | 'ATTACHMENT_DELETED'
  | 'DELETED'
  | 'PDF_GENERATED'

export async function auditTreatmentAssessmentAction(params: {
  userId: string
  serviceClientId: string
  assessmentId: string
  action: TreatmentAssessmentAuditAction
  detail?: string
}): Promise<void> {
  const suffix = params.detail ? `:${params.detail}` : ''
  await auditClientAction({
    userId: params.userId,
    serviceClientId: params.serviceClientId,
    action: `TREATMENT_ASSESSMENT:${params.action}:${params.assessmentId}${suffix}`,
  })
}
