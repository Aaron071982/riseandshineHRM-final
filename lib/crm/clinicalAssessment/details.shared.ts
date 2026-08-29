/** Curated key-details snapshot — no parsing, nearly all fields optional. */

export const DEFAULT_DIAGNOSIS = 'F84.0 Autism Spectrum Disorder'

export const SERVICE_LOCATION_OPTIONS = [
  'Home',
  'School',
  'Clinic',
  'Community',
  'Telehealth',
] as const

export const RISK_FACTOR_OPTIONS = [
  'Assaultive',
  'SIB',
  'Fire-setting',
  'Impulsive',
  'Self-mutilation',
  'Family violence',
  'Prior psychiatric',
  'Elopement',
  'Sexually offending',
  'Substance abuse',
  'Psychotic',
  'Caring for ill family member',
  'Coping with loss',
  'Other',
] as const

export const GOAL_AREA_OPTIONS = [
  'Behavior Reduction',
  'Communication',
  'Social',
  'Adaptive',
  'Living/self-help',
] as const

export type AssessmentDetailsInput = {
  patientName?: string | null
  dob?: string | null
  age?: string | null
  diagnosis?: string | null
  comorbidDiagnosis?: string | null
  reportDate?: string | null
  assessorName?: string | null
  assessorCredentials?: string | null
  referringProvider?: string | null
  npi?: string | null
  hrs97151?: string | null
  hrs97153?: string | null
  hrs97155?: string | null
  hrs97156?: string | null
  hrs97157?: string | null
  servicePeriod?: string | null
  locations?: string[] | null
  reasonForAssessment?: string | null
  interferingBehaviors?: string | null
  targetBehavior1?: string | null
  targetBehavior2?: string | null
  targetBehavior3?: string | null
  medications?: string | null
  allergies?: string | null
  reassessmentDate?: string | null
  riskFactors?: string[] | null
  riskFactorsOther?: string | null
  vinelandDate?: string | null
  atecDate?: string | null
  fastDate?: string | null
  vinelandCommScore?: string | null
  vinelandSocScore?: string | null
  goalAreas?: string[] | null
  speech?: string | null
  ot?: string | null
  pt?: string | null
  teacher?: string | null
  pcp?: string | null
  bcbaName?: string | null
  bcbaDate?: string | null
  parentName?: string | null
  parentDate?: string | null
}

export type AssessmentDetailsRecord = {
  id: string
  assessmentId: string
  patientName: string | null
  dob: Date | null
  age: string | null
  diagnosis: string | null
  comorbidDiagnosis: string | null
  reportDate: Date | null
  assessorName: string | null
  assessorCredentials: string | null
  referringProvider: string | null
  npi: string | null
  hrs97151: string | null
  hrs97153: string | null
  hrs97155: string | null
  hrs97156: string | null
  hrs97157: string | null
  servicePeriod: string | null
  locations: string[]
  reasonForAssessment: string | null
  interferingBehaviors: string | null
  targetBehavior1: string | null
  targetBehavior2: string | null
  targetBehavior3: string | null
  medications: string | null
  allergies: string | null
  reassessmentDate: Date | null
  riskFactors: string[]
  riskFactorsOther: string | null
  vinelandDate: Date | null
  atecDate: Date | null
  fastDate: Date | null
  vinelandCommScore: string | null
  vinelandSocScore: string | null
  goalAreas: string[]
  speech: string | null
  ot: string | null
  pt: string | null
  teacher: string | null
  pcp: string | null
  bcbaName: string | null
  bcbaDate: Date | null
  parentName: string | null
  parentDate: Date | null
  updatedAt: Date
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function trimOrNull(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  return t ? t : null
}

function stringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function normalizeAssessmentDetailsInput(
  input: AssessmentDetailsInput
): Omit<
  AssessmentDetailsRecord,
  'id' | 'assessmentId' | 'updatedAt'
> {
  return {
    patientName: trimOrNull(input.patientName),
    dob: parseDate(input.dob),
    age: trimOrNull(input.age),
    diagnosis: trimOrNull(input.diagnosis),
    comorbidDiagnosis: trimOrNull(input.comorbidDiagnosis),
    reportDate: parseDate(input.reportDate),
    assessorName: trimOrNull(input.assessorName),
    assessorCredentials: trimOrNull(input.assessorCredentials),
    referringProvider: trimOrNull(input.referringProvider),
    npi: trimOrNull(input.npi),
    hrs97151: trimOrNull(input.hrs97151),
    hrs97153: trimOrNull(input.hrs97153),
    hrs97155: trimOrNull(input.hrs97155),
    hrs97156: trimOrNull(input.hrs97156),
    hrs97157: trimOrNull(input.hrs97157),
    servicePeriod: trimOrNull(input.servicePeriod),
    locations: stringArray(input.locations),
    reasonForAssessment: trimOrNull(input.reasonForAssessment),
    interferingBehaviors: trimOrNull(input.interferingBehaviors),
    targetBehavior1: trimOrNull(input.targetBehavior1),
    targetBehavior2: trimOrNull(input.targetBehavior2),
    targetBehavior3: trimOrNull(input.targetBehavior3),
    medications: trimOrNull(input.medications),
    allergies: trimOrNull(input.allergies),
    reassessmentDate: parseDate(input.reassessmentDate),
    riskFactors: stringArray(input.riskFactors),
    riskFactorsOther: trimOrNull(input.riskFactorsOther),
    vinelandDate: parseDate(input.vinelandDate),
    atecDate: parseDate(input.atecDate),
    fastDate: parseDate(input.fastDate),
    vinelandCommScore: trimOrNull(input.vinelandCommScore),
    vinelandSocScore: trimOrNull(input.vinelandSocScore),
    goalAreas: stringArray(input.goalAreas),
    speech: trimOrNull(input.speech),
    ot: trimOrNull(input.ot),
    pt: trimOrNull(input.pt),
    teacher: trimOrNull(input.teacher),
    pcp: trimOrNull(input.pcp),
    bcbaName: trimOrNull(input.bcbaName),
    bcbaDate: parseDate(input.bcbaDate),
    parentName: trimOrNull(input.parentName),
    parentDate: parseDate(input.parentDate),
  }
}

export function mapAssessmentDetailsRow(row: {
  id: string
  assessmentId: string
  patientName: string | null
  dob: Date | null
  age: string | null
  diagnosis: string | null
  comorbidDiagnosis: string | null
  reportDate: Date | null
  assessorName: string | null
  assessorCredentials: string | null
  referringProvider: string | null
  npi: string | null
  hrs97151: string | null
  hrs97153: string | null
  hrs97155: string | null
  hrs97156: string | null
  hrs97157: string | null
  servicePeriod: string | null
  locations: unknown
  reasonForAssessment: string | null
  interferingBehaviors: string | null
  targetBehavior1: string | null
  targetBehavior2: string | null
  targetBehavior3: string | null
  medications: string | null
  allergies: string | null
  reassessmentDate: Date | null
  riskFactors: unknown
  riskFactorsOther: string | null
  vinelandDate: Date | null
  atecDate: Date | null
  fastDate: Date | null
  vinelandCommScore: string | null
  vinelandSocScore: string | null
  goalAreas: unknown
  speech: string | null
  ot: string | null
  pt: string | null
  teacher: string | null
  pcp: string | null
  bcbaName: string | null
  bcbaDate: Date | null
  parentName: string | null
  parentDate: Date | null
  updatedAt: Date
}): AssessmentDetailsRecord {
  return {
    ...row,
    locations: stringArray(row.locations),
    riskFactors: stringArray(row.riskFactors),
    goalAreas: stringArray(row.goalAreas),
  }
}

function hasText(v: string | null | undefined): boolean {
  return !!v?.trim()
}

function hasDate(v: Date | null | undefined): boolean {
  return v != null && !Number.isNaN(v.getTime())
}

export function assessmentDetailsHasSafetyFlags(
  details: AssessmentDetailsRecord | null
): boolean {
  if (!details) return false
  return details.riskFactors.length > 0 || hasText(details.riskFactorsOther)
}

export function groupHasContent(
  group: 'client' | 'services' | 'clinical' | 'instruments' | 'goals' | 'careTeam' | 'signOff',
  d: AssessmentDetailsRecord | null
): boolean {
  if (!d) return false
  switch (group) {
    case 'client':
      return (
        hasText(d.patientName) ||
        hasDate(d.dob) ||
        hasText(d.age) ||
        hasText(d.diagnosis) ||
        hasText(d.comorbidDiagnosis) ||
        hasDate(d.reportDate) ||
        hasText(d.assessorName) ||
        hasText(d.assessorCredentials) ||
        hasText(d.referringProvider) ||
        hasText(d.npi)
      )
    case 'services':
      return (
        hasText(d.hrs97151) ||
        hasText(d.hrs97153) ||
        hasText(d.hrs97155) ||
        hasText(d.hrs97156) ||
        hasText(d.hrs97157) ||
        hasText(d.servicePeriod) ||
        d.locations.length > 0
      )
    case 'clinical':
      return (
        hasText(d.reasonForAssessment) ||
        hasText(d.interferingBehaviors) ||
        hasText(d.targetBehavior1) ||
        hasText(d.targetBehavior2) ||
        hasText(d.targetBehavior3) ||
        hasText(d.medications) ||
        hasText(d.allergies) ||
        hasDate(d.reassessmentDate)
      )
    case 'instruments':
      return (
        hasDate(d.vinelandDate) ||
        hasDate(d.atecDate) ||
        hasDate(d.fastDate) ||
        hasText(d.vinelandCommScore) ||
        hasText(d.vinelandSocScore)
      )
    case 'goals':
      return d.goalAreas.length > 0
    case 'careTeam':
      return (
        hasText(d.speech) ||
        hasText(d.ot) ||
        hasText(d.pt) ||
        hasText(d.teacher) ||
        hasText(d.pcp)
      )
    case 'signOff':
      return (
        hasText(d.bcbaName) ||
        hasDate(d.bcbaDate) ||
        hasText(d.parentName) ||
        hasDate(d.parentDate)
      )
    default:
      return false
  }
}

export function formatDetailDate(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}
