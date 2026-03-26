/**
 * Shared employee-type patterns for admin employee routes (BCBA, Billing, Marketing, Call Center).
 * Used by the consolidated delete route and any employee-type-aware APIs.
 */

/** URL slug for employee profile type (used in /api/admin/employees/[employeeId]/[id]/delete). */
export const EMPLOYEE_TYPE_SLUGS = ['bcba', 'billing', 'marketing', 'call-center'] as const
export type EmployeeTypeSlug = (typeof EMPLOYEE_TYPE_SLUGS)[number]

export function isEmployeeTypeSlug(value: string): value is EmployeeTypeSlug {
  return EMPLOYEE_TYPE_SLUGS.includes(value as EmployeeTypeSlug)
}
