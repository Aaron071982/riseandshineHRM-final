import type { CrmRole } from '@prisma/client'

/** What each CRM role unlocks — shown on Admin Management so privileges are visible. */
export const CRM_ROLE_PRIVILEGES: {
  role: CrmRole
  label: string
  group: 'Leadership' | 'Departments' | 'Clinical portal'
  summary: string
  privileges: string[]
}[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super admin',
    group: 'Leadership',
    summary: 'Full CRM + Admin Management (grant/revoke roles).',
    privileges: [
      'See and edit all clients',
      'Open Admin Management',
      'Grant / revoke every CRM role',
      'Restore deleted families & kiosk tools',
    ],
  },
  {
    role: 'MANAGEMENT',
    label: 'Management',
    group: 'Leadership',
    summary: 'Full caseload without Admin Management.',
    privileges: [
      'See and edit all clients',
      'All department queues',
      'Cannot grant/revoke roles',
    ],
  },
  {
    role: 'INTAKE',
    label: 'Intake',
    group: 'Departments',
    summary: 'New inquiries and early funnel ownership.',
    privileges: [
      'Create clients at Inquiry',
      'Own Intake queue',
      'Edit clients in intake stages',
    ],
  },
  {
    role: 'CLINICAL',
    label: 'Clinical',
    group: 'Departments',
    summary: 'Internal clinical department queue.',
    privileges: [
      'Own Clinical queue',
      'Assessments & clinical notes',
      'Full CRM client tabs (scoped)',
    ],
  },
  {
    role: 'CLINICAL_SUPPORT',
    label: 'Clinical support',
    group: 'Departments',
    summary: 'Supports clinical work without owning the queue.',
    privileges: ['Assist clinical caseload', 'View clinical surfaces'],
  },
  {
    role: 'AUTHORIZATION',
    label: 'Authorization',
    group: 'Departments',
    summary: 'Auths, hours, and payor paperwork.',
    privileges: ['Own Authorization queue', 'Manage authorizations & templates'],
  },
  {
    role: 'STAFFING',
    label: 'Staffing',
    group: 'Departments',
    summary: 'RBT matching and replacement.',
    privileges: ['Own Staffing queue', 'Assign / replace RBTs'],
  },
  {
    role: 'CASE_COORDINATION',
    label: 'Case coordination',
    group: 'Departments',
    summary: 'Scheduling coordination and case owners.',
    privileges: ['Own Case Coordination queue', 'Coordinate schedules & handoffs'],
  },
  {
    role: 'BILLING',
    label: 'Billing',
    group: 'Departments',
    summary: 'Billing queue and related billing tools.',
    privileges: ['Own Billing queue', 'Billing surfaces in CRM'],
  },
  {
    role: 'BCBA',
    label: 'BCBA (portal)',
    group: 'Clinical portal',
    summary: 'External BCBA — assigned clients only in /portal.',
    privileges: [
      'Log in to clinical portal (/portal)',
      'Only clients where they are Assigned BCBA',
      'Overview + Assessment (limited tabs)',
      'Pay stubs in portal',
      'No full CRM Admin / department queues',
    ],
  },
  {
    role: 'CLINICAL_LEAD',
    label: 'Clinical lead (portal)',
    group: 'Clinical portal',
    summary: 'Clinical lead portal — all clients, clinical tabs only.',
    privileges: [
      'Log in to clinical portal (/portal)',
      'See all clients on clinical surfaces',
      'Overview + Assessment',
      'No full CRM unless also Management / Super admin / a department role',
    ],
  },
]

export const CRM_ROLE_OPTIONS: { value: CrmRole; label: string }[] =
  CRM_ROLE_PRIVILEGES.map((r) => ({ value: r.role, label: r.label }))
