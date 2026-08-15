/** ABA CPT codes used on client authorizations. */
export const CPT_CODES = [
  { code: '97151', label: 'Behavior identification assessment' },
  { code: '97152', label: 'Behavior identification supporting assessment' },
  { code: '97153', label: 'Adaptive behavior treatment by protocol' },
  { code: '97154', label: 'Group adaptive behavior treatment by protocol' },
  { code: '97155', label: 'Adaptive behavior treatment with protocol modification' },
  { code: '97156', label: 'Family adaptive behavior treatment guidance' },
  { code: '97157', label: 'Multiple-family group adaptive behavior treatment guidance' },
  { code: '97158', label: 'Group adaptive behavior treatment with protocol modification' },
] as const

export type CptCode = (typeof CPT_CODES)[number]['code']

export const CPT_CODE_SET = new Set<string>(CPT_CODES.map((c) => c.code))

export function cptLabel(code: string): string {
  return CPT_CODES.find((c) => c.code === code)?.label ?? code
}

export function isValidCpt(code: string): code is CptCode {
  return CPT_CODE_SET.has(code)
}
