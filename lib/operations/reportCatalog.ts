/** Client-safe report catalog (no Prisma). */
export const REPORT_CATALOG = [
  {
    key: 'pipeline-health',
    title: 'Pipeline Health',
    description:
      'Visible LIVE clients by pipeline stage, with median days in stage and stall flags.',
  },
  {
    key: 'unstaffed-active',
    title: 'Unstaffed Active Clients',
    description:
      'Post-authorization / active clients with no active RBT schedule assignment.',
  },
  {
    key: 'missing-documents',
    title: 'Missing Documents',
    description:
      'Outstanding document requirements by client — source for Documents Needed nudges.',
  },
  {
    key: 'authorizations-expiring',
    title: 'Authorizations Expiring',
    description:
      'ASSESSMENT and TREATMENT auths inside the 45/30/14/7/0-day attention bands.',
  },
  {
    key: 'reassessments-due',
    title: 'Reassessments Due',
    description: 'TREATMENT authorization end dates in the same band engine.',
  },
  {
    key: 'under-approved',
    title: 'Under-Approved Authorizations',
    description: 'Auth lines where unitsApproved < unitsRequested.',
  },
  {
    key: 'department-queue',
    title: 'Department Queue Load',
    description: 'LIVE clients per owning department and claimant.',
  },
  {
    key: 'cc-load',
    title: 'Case Coordinator Load',
    description: 'Clients per CC with assigned / ready / upcoming piles.',
  },
  {
    key: 'email-activity',
    title: 'Email Activity',
    description:
      'CRM email tab send log — powers the internal Weekly Summary email.',
  },
  {
    key: 'new-intakes',
    title: 'New Intakes This Week',
    description: 'New clients with intake document completeness.',
  },
] as const

export type ReportCatalogKey = (typeof REPORT_CATALOG)[number]['key']
