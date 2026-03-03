const CPT_CODE_REGEX = /^[0-9A-Za-z]{4,10}$/

export interface ClinicalLogInput {
  minutes?: number | null
  units?: number | null
  cptCode: string
}

export function validateCptCode(cptCode: string): string | null {
  const value = (cptCode || '').trim()
  if (!value) return 'CPT code is required'
  if (!CPT_CODE_REGEX.test(value)) return 'CPT code format is invalid'
  return null
}

export function validateMinutes(minutes?: number | null): string | null {
  if (minutes == null) return null
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Minutes must be greater than 0'
  return null
}

export function validateUnits(units?: number | null): string | null {
  if (units == null) return null
  if (!Number.isFinite(units) || units < 0) return 'Units must be greater than or equal to 0'
  return null
}

