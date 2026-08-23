import type { CrmRole } from '@prisma/client'

/** Client-safe role labels for training modules (no server imports). */
export const TRAINING_MODULE_ROLE_LABELS: Record<CrmRole, string> = {
  SUPER_ADMIN: 'Super admin',
  MANAGEMENT: 'Management',
  INTAKE: 'Intake',
  CLINICAL: 'Clinical',
  AUTHORIZATION: 'Authorization',
  STAFFING: 'Staffing',
  CASE_COORDINATION: 'Case coordination',
  BILLING: 'Billing',
}
