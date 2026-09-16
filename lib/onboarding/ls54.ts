/** NYS LS-54 employer section defaults and PDF field mapping. */
export const LS54_EMPLOYER = {
  /** Legal employer / notice signatory (Section 1 — Name). */
  employerName: 'Kazi Siyam',
  /** Trade name shown as DBA on the form. */
  dbaName: 'Rise & Shine ABA LLC',
  physicalAddress: '1655 Richmond Ave, Staten Island, NY 10314',
  mailingAddress: '1655 Richmond Ave, Staten Island, NY 10314',
  phone: '(929) 460-9600',
  phoneParts: { area: '929', exchange: '460', line: '9600' } as const,
  /** Day or schedule employees are paid (form “Regular payday” line). */
  regularPaydaySchedule: 'Every other Friday',
  /** Pay frequency label shown in admin UI. */
  payFrequency: 'Bi-weekly',
  /** Preparer line (bottom of acknowledgement column). */
  preparerNameAndTitle: 'Kazi Siyam, Owner',
} as const

export const LS54_SLUG = 'ls54-wage-notice'

export function parseHourlyRate(value: string): number | null {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatOvertimeRate(hourly: number): string {
  return (hourly * 1.5).toFixed(2)
}

export function formatHourlyRateDisplay(hourly: number): string {
  return hourly.toFixed(2)
}

export type Ls54FillInput = {
  employeeName: string
  employeeRateOfPay: string
  overtimeRate: string
}

/** Map admin form values to LS-54 AcroForm field names (see scripts/list-pdf-fields.ts). */
export function buildLs54FieldValues(input: Ls54FillInput): Record<string, string | boolean> {
  const parsedRate = parseHourlyRate(input.employeeRateOfPay)
  const rate =
    parsedRate != null
      ? formatHourlyRateDisplay(parsedRate)
      : String(input.employeeRateOfPay).replace(/[^0-9.]/g, '')
  const overtimeParsed = parseHourlyRate(input.overtimeRate)
  const overtime =
    overtimeParsed != null
      ? formatHourlyRateDisplay(overtimeParsed)
      : parsedRate != null
        ? formatOvertimeRate(parsedRate)
        : String(input.overtimeRate ?? '').replace(/[^0-9.]/g, '')

  return {
    // Employer block (left column)
    Apprenticeship_ApplicantNotification_EmployerName: LS54_EMPLOYER.employerName,
    Contact_OtherName_s_: LS54_EMPLOYER.dbaName,
    Business_BusinessAddress_BusinessStreetAddress1: LS54_EMPLOYER.physicalAddress,
    Generic_GenericMultiLine_MultiLine1: LS54_EMPLOYER.mailingAddress,
    Contact_OtherPhone1: LS54_EMPLOYER.phoneParts.area,
    Contact_OtherPhone2: LS54_EMPLOYER.phoneParts.exchange,
    Contact_OtherPhone3: LS54_EMPLOYER.phoneParts.line,
    Business_PreparerName: LS54_EMPLOYER.preparerNameAndTitle,

    // Employee + compensation (middle / right columns)
    Business_EmployeeName: input.employeeName,
    Employment_RegularRates_PerRate1: rate,
    WorkHistory_JobInfo_PerTime1: overtime,
    Generic_GenericTextField_TextField1: LS54_EMPLOYER.regularPaydaySchedule,

    // Notice given: At hiring
    Generic_GenericYesNo_Yes1: true,
    // Pay is: Bi-weekly
    Generic_GenericYesNo_Yes2: true,
    // Allowances: None
    Employment_JobBenefits_None: true,
    // Primary language: English
    Employment_PrimaryLanguageEnglish: true,
  }
}

/** Fields that must be non-empty after fill — used to catch blank PDFs before upload. */
export const LS54_REQUIRED_TEXT_FIELDS = [
  'Apprenticeship_ApplicantNotification_EmployerName',
  'Business_BusinessAddress_BusinessStreetAddress1',
  'Business_EmployeeName',
  'Employment_RegularRates_PerRate1',
  'WorkHistory_JobInfo_PerTime1',
] as const

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
