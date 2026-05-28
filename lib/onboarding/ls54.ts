/** NYS LS-54 employer section defaults and PDF field mapping. */
export const LS54_EMPLOYER = {
  employerName: 'Rise & Shine ABA LLC',
  physicalAddress: '424 Grandview Avenue, Staten Island, NY 10303',
  phone: '(929) 460-9600',
  regularPayday: 'Bi-weekly',
} as const

export const LS54_SLUG = 'ls54-wage-notice'

export function parseHourlyRate(value: string): number | null {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatOvertimeRate(hourly: number): string {
  return (hourly * 1.5).toFixed(2)
}

/** Map admin form values to LS-54 AcroForm field names. */
export function buildLs54FieldValues(input: {
  employeeName: string
  employeeRateOfPay: string
  overtimeRate: string
}): Record<string, string> {
  return {
    Apprenticeship_ApplicantNotification_EmployerName: LS54_EMPLOYER.employerName,
    Business_BusinessAddress_BusinessStreetAddress1: LS54_EMPLOYER.physicalAddress,
    Contact_OtherPhone1: '929',
    Contact_OtherPhone2: '460',
    Contact_OtherPhone3: '9600',
    Business_EmployeeName: input.employeeName,
    Employment_RegularRates_PerRate1: input.employeeRateOfPay,
    WorkHistory_JobInfo_PerTime1: input.overtimeRate,
    Generic_GenericTextField_TextField1: LS54_EMPLOYER.regularPayday,
  }
}
