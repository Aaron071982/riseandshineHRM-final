import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import {
  LS54_EMPLOYER,
  buildLs54FieldValues,
  parseHourlyRate,
} from '@/lib/onboarding/ls54'
import { fillLs54Pdf } from '@/lib/onboarding/ls54-pdf'

describe('LS-54 wage notice', () => {
  it('maps employer as Kazi Siyam at 1655 Richmond Ave and pay rates', () => {
    const values = buildLs54FieldValues({
      employeeName: 'Jordan Example',
      employeeRateOfPay: '22',
      overtimeRate: '33',
    })
    expect(values.Apprenticeship_ApplicantNotification_EmployerName).toBe(
      'Kazi Siyam'
    )
    expect(values.Contact_OtherName_s_).toBe('Rise & Shine ABA LLC')
    expect(values.Business_BusinessAddress_BusinessStreetAddress1).toContain(
      '1655 Richmond Ave'
    )
    expect(values.Generic_GenericMultiLine_MultiLine1).toContain(
      '1655 Richmond Ave'
    )
    expect(values.Business_PreparerName).toBe(LS54_EMPLOYER.preparerNameAndTitle)
    expect(values.Business_EmployeeName).toBe('Jordan Example')
    expect(values.Employment_RegularRates_PerRate1).toBe('22.00')
    expect(values.WorkHistory_JobInfo_PerTime1).toBe('33.00')
    expect(parseHourlyRate('$22.50/hr')).toBe(22.5)
  })

  it('fills employer and pay so viewers show each value once', async () => {
    const templatePath = join(process.cwd(), 'onboarding-documents/LS54.pdf')
    const pdfBytes = new Uint8Array(readFileSync(templatePath))
    const filled = await fillLs54Pdf(pdfBytes, {
      employeeName: 'Jordan Example',
      employeeRateOfPay: '22.00',
      overtimeRate: '33.00',
    })

    expect(filled.length).toBeGreaterThan(20_000)

    const doc = await PDFDocument.load(filled)
    const form = doc.getForm()
    expect(form.getTextField('Employment_RegularRates_PerRate1').getText()).toBe(
      '22.00'
    )
    expect(
      form.getTextField('Apprenticeship_ApplicantNotification_EmployerName').getText()
    ).toBe('Kazi Siyam')
    expect(form.getTextField('Business_EmployeeName').getText()).toBe(
      'Jordan Example'
    )
  })
})
