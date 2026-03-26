/** Top-level departments (org chart pills + colors). "HR" replaces legacy "RBT" label. */
export const ORG_DEPARTMENTS = [
  'Leadership',
  'Clinical',
  'HR',
  'Admin',
  'Billing',
  'Marketing',
  'Technology',
] as const

export type OrgDepartment = (typeof ORG_DEPARTMENTS)[number]

/** Sub-groups per department for filtering and forms (extend as needed). */
export const SUB_DEPARTMENTS_BY_DEPARTMENT: Record<OrgDepartment, readonly string[]> = {
  Leadership: ['Executive', 'Strategy', 'Board'],
  Clinical: ['BCBA', 'BCaBA', 'Clinical supervision', 'Quality'],
  HR: ['Recruiting', 'People operations', 'Benefits', 'Compliance', 'HR general'],
  Admin: ['Operations', 'Front office', 'Facilities'],
  Billing: ['Claims', 'Revenue cycle', 'Credentialing'],
  Marketing: ['Brand', 'Community', 'Digital'],
  Technology: ['Engineering', 'IT', 'Data & analytics'],
}

export const DEPARTMENT_COLORS: Record<string, string> = {
  Leadership: '#f97316',
  Clinical: '#8b5cf6',
  HR: '#22c55e',
  /** Legacy rows may still store "RBT" — same color as HR */
  RBT: '#22c55e',
  Admin: '#3b82f6',
  Billing: '#f59e0b',
  Marketing: '#ec4899',
  Technology: '#6b7280',
}

/** Map stored DB value to display label (RBT → HR). */
export function normalizeDepartmentForDisplay(department: string | null | undefined): string | null {
  if (!department?.trim()) return null
  const d = department.trim()
  if (d.toLowerCase() === 'rbt') return 'HR'
  return d
}

export function departmentBorderColor(department: string | null | undefined): string {
  const display = normalizeDepartmentForDisplay(department) ?? department
  if (!display) return '#e5e7eb'
  const key = Object.keys(DEPARTMENT_COLORS).find((k) => k.toLowerCase() === display.toLowerCase())
  return key ? DEPARTMENT_COLORS[key] : '#e5e7eb'
}

export function defaultAvatarColorForDepartment(department: string | null | undefined): string {
  return departmentBorderColor(department)
}

/** Whether a node's department matches the top-level filter pill (All | Leadership | …). */
export function departmentMatchesFilter(storedDepartment: string | null | undefined, filter: string): boolean {
  if (!filter || filter === 'All') return true
  const eff = normalizeDepartmentForDisplay(storedDepartment) ?? storedDepartment?.trim()
  if (!eff) return false
  return eff.toLowerCase() === filter.toLowerCase()
}

/** Subgroup filter when a department is selected; ignored when department filter is All. */
export function subDepartmentMatchesFilter(
  storedSub: string | null | undefined,
  departmentFilter: string,
  subDepartmentFilter: string
): boolean {
  if (departmentFilter === 'All') return true
  if (subDepartmentFilter === 'All') return true
  if (subDepartmentFilter === 'Unassigned') return !storedSub?.trim()
  return (storedSub || '').toLowerCase() === subDepartmentFilter.toLowerCase()
}
