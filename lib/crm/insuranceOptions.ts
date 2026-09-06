export const CLIENT_INSURANCE_OPTIONS = [
  'Aetna',
  'Anthem',
  'Beacon Health',
  'Blue Cross Blue Shield',
  'Cigna',
  'EmblemHealth',
  'Empire BlueCross BlueShield',
  'Fidelis',
  'Healthfirst',
  'Magellan',
  'Medicaid',
  'Medicaid FFS / NY Medicaid ABA',
  'MetroPlus',
  'Molina',
  'Tricare',
  'UnitedHealthcare',
] as const

export function insuranceOptionsForValue(value: string | null | undefined): string[] {
  const current = value?.trim()
  if (!current) return [...CLIENT_INSURANCE_OPTIONS]
  if (CLIENT_INSURANCE_OPTIONS.includes(current as (typeof CLIENT_INSURANCE_OPTIONS)[number])) {
    return [...CLIENT_INSURANCE_OPTIONS]
  }
  return [current, ...CLIENT_INSURANCE_OPTIONS]
}
