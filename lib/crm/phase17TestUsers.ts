/**
 * Phase 17 role-specific CRM test users (dev only).
 * HRM role is ADMIN so they can enter Client Services; CRM roles gate visibility.
 */
import type { CrmRole } from '@prisma/client'

export const PHASE17_ROLE_TEST_USERS: {
  email: string
  name: string
  crmRole: CrmRole
}[] = [
  {
    email: 'intake-only@example.com',
    name: 'Phase17 Intake',
    crmRole: 'INTAKE',
  },
  {
    email: 'clinical-only@example.com',
    name: 'Phase17 Clinical',
    crmRole: 'CLINICAL',
  },
  {
    email: 'cc-only@example.com',
    name: 'Phase17 Case Coordination',
    crmRole: 'CASE_COORDINATION',
  },
  {
    email: 'full-visibility@example.com',
    name: 'Phase17 Full Visibility',
    crmRole: 'MANAGEMENT',
  },
]
