import type { CrmRole } from '@prisma/client'

/** Warm-toned role chips for profile header */
export const CRM_ROLE_CHIP: Record<CrmRole, string> = {
  SUPER_ADMIN: 'bg-[var(--urgent-bg)] text-[var(--urgent)] ring-[var(--urgent)]/30',
  MANAGEMENT: 'bg-[var(--stage-coord-bg)] text-[var(--stage-coord)] ring-[var(--stage-coord)]/25',
  INTAKE: 'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)] ring-[var(--sunrise)]/30',
  CLINICAL: 'bg-[var(--stage-clinical-bg)] text-[var(--stage-clinical)] ring-[var(--stage-clinical)]/25',
  AUTHORIZATION: 'bg-[var(--amber-bg)] text-[var(--amber)] ring-[var(--amber)]/30',
  STAFFING: 'bg-[var(--stage-staffing-bg)] text-[var(--stage-staffing)] ring-[var(--stage-staffing)]/25',
  CASE_COORDINATION:
    'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)] ring-[var(--sunrise)]/35',
  BILLING: 'bg-[var(--line-2)] text-[var(--espresso)] ring-[var(--line)]',
}

export const STAGE_CHIP: Record<string, string> = {
  INQUIRY: 'bg-[var(--line-2)] text-[var(--muted-ink)]',
  INTAKE: 'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)]',
  CLINICAL: 'bg-[var(--stage-clinical-bg)] text-[var(--stage-clinical)]',
  STAFFING: 'bg-[var(--stage-staffing-bg)] text-[var(--stage-staffing)]',
  ACTIVE: 'bg-[var(--stage-active-bg)] text-[var(--stage-active)]',
  TREATMENT_PLAN: 'bg-[var(--sunrise-soft)] text-[var(--sunrise-dark)]',
}

export function stageChipClass(stage: string): string {
  return STAGE_CHIP[stage] ?? 'bg-[var(--line-2)] text-[var(--muted-ink)]'
}
