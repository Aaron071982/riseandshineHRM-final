/** NYS LS-54 employer section defaults and PDF field mapping. */
export const LS54_EMPLOYER = {
  employerName: 'Rise & Shine ABA LLC',
  physicalAddress: '424 Grandview Avenue, Staten Island, NY 10303',
  phone: '(929) 460-9600',
  /** Day or schedule employees are paid (form “Regular payday” line). */
  regularPaydaySchedule: 'Every other Friday',
  /** Pay frequency label shown in admin UI. */
  payFrequency: 'Bi-weekly',
} as const

export const LS54_SLUG = 'ls54-wage-notice'

export function parseHourlyRate(value: string): number | null {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatOvertimeRate(hourly: number): string {
  return (hourly * 1.5).toFixed(2)
}

export type Ls54FillInput = {
  employeeName: string
  employeeRateOfPay: string
  overtimeRate: string
}

/** Map admin form values to LS-54 AcroForm field names (see scripts/list-pdf-fields.ts). */
export function buildLs54FieldValues(input: Ls54FillInput): Record<string, string | boolean> {
  return {
    // Employer block
    Apprenticeship_ApplicantNotification_EmployerName: LS54_EMPLOYER.employerName,
    Business_BusinessAddress_BusinessStreetAddress1: LS54_EMPLOYER.physicalAddress,
    Contact_OtherPhone1: '929',
    Contact_OtherPhone2: '460',
    Contact_OtherPhone3: '9600',
    Business_PreparerName: 'Rise & Shine ABA — Human Resources',

    // Employee + compensation
    Business_EmployeeName: input.employeeName,
    Employment_RegularRates_PerRate1: input.employeeRateOfPay,
    WorkHistory_JobInfo_PerTime1: input.overtimeRate,
    Generic_GenericTextField_TextField1: LS54_EMPLOYER.regularPaydaySchedule,

    // Notice given at hiring (first “Yes” in notice section)
    Generic_GenericYesNo_Yes1: true,
    // Pay is: Bi-weekly (second “Yes” in pay-frequency row on LS-54)
    Generic_GenericYesNo_Yes2: true,
    // Allowances: None
    Employment_JobBenefits_None: true,
    // Primary language: English
    Employment_PrimaryLanguageEnglish: true,
  }
}

export type Ls54FormMeta = {
  employeeRateOfPay: string
  overtimeRate: string
  employeeName: string
  sentAt: string
  sentBy: string
}

export function parseLs54FormMeta(notes: string | null | undefined): Ls54FormMeta | null {
  if (!notes?.trim()) return null
  try {
    const parsed = JSON.parse(notes) as Partial<Ls54FormMeta>
    if (
      typeof parsed.employeeRateOfPay === 'string' &&
      typeof parsed.employeeName === 'string' &&
      typeof parsed.overtimeRate === 'string'
    ) {
      return {
        employeeRateOfPay: parsed.employeeRateOfPay,
        overtimeRate: parsed.overtimeRate,
        employeeName: parsed.employeeName,
        sentAt: typeof parsed.sentAt === 'string' ? parsed.sentAt : '',
        sentBy: typeof parsed.sentBy === 'string' ? parsed.sentBy : '',
      }
    }
  } catch {
    return null
  }
  return null
}
