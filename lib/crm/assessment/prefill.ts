import { formatCalendarDate, parseCalendarDate } from '@/lib/billing/calendarDate'
import type { ServiceClient } from '@prisma/client'
import {
  defaultAssessmentSections,
  type AssessmentSectionData,
  type AssessmentSummary,
} from '@/lib/crm/assessment/assessment.schema'

export function computeAgeFromDob(dob: Date | null): string {
  if (!dob) return ''
  const today = new Date()
  let years = today.getUTCFullYear() - dob.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth()
  const dayDiff = today.getUTCDate() - dob.getUTCDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1
  }
  return years >= 0 ? String(years) : ''
}

export function todayCalendarDateString(): string {
  return formatCalendarDate(new Date()) ?? ''
}

export function dobToInputString(dob: Date | null | undefined): string {
  if (!dob) return ''
  return formatCalendarDate(dob) ?? ''
}

/** Prefill summary from ServiceClient for a new FORM assessment. */
export function prefillSummaryFromClient(
  client: Pick<
    ServiceClient,
    | 'firstName'
    | 'lastName'
    | 'dateOfBirth'
    | 'parentName'
    | 'diagnosis'
    | 'referringProvider'
  >
): AssessmentSummary {
  const dob = client.dateOfBirth ?? null
  const dobStr = dobToInputString(dob)
  return {
    patientName: `${client.firstName} ${client.lastName}`.trim(),
    parentName: client.parentName ?? '',
    diagnosis: client.diagnosis?.trim() || 'F84.0 Autism Spectrum Disorder',
    comorbidDiagnosis: '',
    dateOfBirth: dobStr,
    age: computeAgeFromDob(dob),
    referringProvider: client.referringProvider?.trim() || '',
    npi: '',
    reportDate: todayCalendarDateString(),
    assessorName: '',
    assessorEmail: '',
    assessorPhone: '',
  }
}

export function sectionsWithClientPrefill(
  client: Pick<
    ServiceClient,
    | 'firstName'
    | 'lastName'
    | 'dateOfBirth'
    | 'parentName'
    | 'diagnosis'
    | 'referringProvider'
  >
): AssessmentSectionData {
  const defaults = defaultAssessmentSections()
  return {
    ...defaults,
    summary: prefillSummaryFromClient(client),
  }
}

export function parseStoredSections(
  record: Record<string, unknown | null>
): Partial<AssessmentSectionData> {
  const out: Partial<AssessmentSectionData> = {}
  for (const key of Object.keys(record)) {
    if (record[key] != null) {
      ;(out as Record<string, unknown>)[key] = record[key]
    }
  }
  return out
}

export function calendarDateFromInput(value: string | null | undefined): Date | null {
  return parseCalendarDate(value)
}
