/**
 * VOB (verification of benefits) → plan-level auth_required.
 * Server-side only — never trust client-supplied authRequired without a validated vobResult.
 * payerType is never used here.
 */

export const VOB_OUTCOMES = [
  'PA_REQUIRED',
  'NO_PA_REQUIRED',
] as const

export type VobOutcome = (typeof VOB_OUTCOMES)[number]

/** Map a stored VOB outcome to plan-level authRequired (default TRUE). */
export function authRequiredFromVobOutcome(outcome: string | null | undefined): boolean {
  const normalized = outcome?.trim().toUpperCase() ?? ''
  if (normalized === 'NO_PA_REQUIRED') return false
  return true
}

export function parseVobOutcome(raw: string): VobOutcome | null {
  const normalized = raw.trim().toUpperCase()
  if (normalized === 'NO_PA_REQUIRED') return 'NO_PA_REQUIRED'
  if (normalized === 'PA_REQUIRED') return 'PA_REQUIRED'
  return null
}

export function isPaStepAutoSatisfied(authRequired: boolean): boolean {
  return !authRequired
}
