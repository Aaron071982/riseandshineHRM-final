/**
 * Client-safe department path helpers (no next/headers / Prisma).
 * Server queue loaders stay in `@/lib/crm/departments`.
 */

export type DeptSlug =
  | 'intake'
  | 'clinical'
  | 'authorization'
  | 'staffing'
  | 'case-coordination'
  | 'billing'

export const DEPT_SLUGS: readonly DeptSlug[] = [
  'intake',
  'clinical',
  'authorization',
  'staffing',
  'case-coordination',
  'billing',
] as const

export function isDeptSlug(v: string): v is DeptSlug {
  return (DEPT_SLUGS as readonly string[]).includes(v)
}

export function deptHref(slug: DeptSlug): string {
  return `/client-services/dept/${slug}`
}
