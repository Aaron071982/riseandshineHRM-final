import type { RBTProfile, Termination, User } from '@prisma/client'
import {
  COMPANY_ADDRESS,
  COMPANY_NAME,
  HR_CONTACT_EMAIL_PHONE,
  HR_CONTACT_NAME,
  HR_SIGNATORY_NAME,
  HR_SIGNATORY_TITLE,
  TERMINATION_REASON_LABELS,
} from './constants'
import { formatDateNY } from './dates'

export type TerminationDocMergeFields = {
  employee_full_name: string
  employee_first_name: string
  employee_id: string
  employee_role: string
  employee_address: string
  company_address: string
  termination_date: string
  benefits_end_date: string
  other_benefit_name: string
  other_benefit_end_date: string
  final_pay_date: string
  today_date: string
  hr_contact_name: string
  hr_contact_email_phone: string
  hr_signatory_name: string
  hr_signatory_title: string
  last_day_worked: string
  regular_wages: string
  overtime_owed: string
  commissions_owed: string
  pto_payout: string
  deductions: string
  net_final_pay: string
  reason_category: string
  reason_narrative: string
  decision_date: string
  decision_maker_name: string
  decision_maker_title: string
  counsel_consulted_yes_no: string
}

export function buildMergeFields(
  profile: RBTProfile,
  termination: Termination,
  decisionMaker: Pick<User, 'name' | 'email'>
): TerminationDocMergeFields {
  const address = [
    profile.addressLine1,
    profile.addressLine2,
    profile.locationCity,
    profile.locationState,
    profile.zipCode,
  ]
    .filter(Boolean)
    .join(', ')

  return {
    employee_full_name: `${profile.firstName} ${profile.lastName}`,
    employee_first_name: profile.firstName,
    employee_id: profile.id,
    employee_role: 'RBT',
    employee_address: address || '—',
    company_address: COMPANY_ADDRESS,
    termination_date: formatDateNY(termination.terminationDate),
    benefits_end_date: formatDateNY(termination.benefitsEndDate),
    other_benefit_name: termination.otherBenefitName || 'Dental / vision (if applicable)',
    other_benefit_end_date: termination.otherBenefitEndDate
      ? formatDateNY(termination.otherBenefitEndDate)
      : formatDateNY(termination.benefitsEndDate),
    final_pay_date: formatDateNY(termination.finalPayDate),
    today_date: formatDateNY(new Date()),
    hr_contact_name: HR_CONTACT_NAME,
    hr_contact_email_phone: HR_CONTACT_EMAIL_PHONE,
    hr_signatory_name: HR_SIGNATORY_NAME,
    hr_signatory_title: HR_SIGNATORY_TITLE,
    last_day_worked: formatDateNY(termination.lastDayWorked),
    regular_wages: termination.regularWages || '—',
    overtime_owed: termination.overtimeOwed || '—',
    commissions_owed: termination.commissionsOwed || '—',
    pto_payout: termination.ptoPayout || '—',
    deductions: termination.deductions || '—',
    net_final_pay: termination.netFinalPay || '—',
    reason_category: TERMINATION_REASON_LABELS[termination.reason] || termination.reason,
    reason_narrative: termination.reasonNarrative || '—',
    decision_date: formatDateNY(termination.decisionDate),
    decision_maker_name: decisionMaker.name || decisionMaker.email || 'Admin',
    decision_maker_title: 'Administrator',
    counsel_consulted_yes_no: termination.counselConsulted ? 'Yes' : 'No',
  }
}

function fill(template: string, fields: TerminationDocMergeFields): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = fields[key as keyof TerminationDocMergeFields]
    return val != null ? String(val) : ''
  })
}

const DOC_SHELL = (title: string, body: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #111; max-width: 700px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 24px; }
  .confidential { color: #b91c1c; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  .sig { margin-top: 48px; }
</style></head><body>${body}</body></html>`

export function generate1956NoticeHtml(fields: TerminationDocMergeFields): string {
  const body = `
<p><strong>${COMPANY_NAME}</strong><br>${fields.company_address}</p>
<p>${fields.today_date}</p>
<p>${fields.employee_full_name}<br>${fields.employee_address}</p>
<p>Dear ${fields.employee_first_name},</p>
<p>This letter confirms that your employment with ${COMPANY_NAME} ends effective <strong>${fields.termination_date}</strong>.</p>
<p>Your employment-connected benefits will be cancelled as follows:</p>
<ul>
  <li>Health / medical coverage ends on: <strong>${fields.benefits_end_date}</strong></li>
  <li>${fields.other_benefit_name} ends on: <strong>${fields.other_benefit_end_date}</strong></li>
</ul>
<p>Your final paycheck will be issued on or before <strong>${fields.final_pay_date}</strong> (the next regularly scheduled payday), consistent with New York Labor Law. Enclosed you will find information regarding your right to apply for unemployment insurance benefits (Form IA 12.3) and information regarding continuation of health coverage.</p>
<p>If you have questions about your final pay or benefits, contact ${fields.hr_contact_name} at ${fields.hr_contact_email_phone}.</p>
<p class="sig">Sincerely,<br><br>${fields.hr_signatory_name}<br>${fields.hr_signatory_title}, ${COMPANY_NAME}</p>
<p><em>Enclosures: Form IA 12.3 (Unemployment Insurance); Benefits/COBRA continuation notice; Final pay summary.</em></p>`
  return DOC_SHELL('§195(6) Termination Notice', body)
}

export function generateDecisionMemoHtml(fields: TerminationDocMergeFields): string {
  const body = `
<p class="confidential">Confidential personnel record — not for employee distribution</p>
<h1>${COMPANY_NAME} — Termination Decision Memo</h1>
<ul style="list-style: none; padding: 0;">
  <li><strong>Employee:</strong> ${fields.employee_full_name} — ID: ${fields.employee_id} — Role: ${fields.employee_role}</li>
  <li><strong>Decision date:</strong> ${fields.decision_date} — <strong>Effective termination:</strong> ${fields.termination_date}</li>
  <li><strong>Decision-maker:</strong> ${fields.decision_maker_name}, ${fields.decision_maker_title}</li>
  <li><strong>Reason category:</strong> ${fields.reason_category}</li>
</ul>
<p><strong>Summary of basis:</strong></p>
<p>${fields.reason_narrative}</p>
<p><strong>Counsel consulted:</strong> ${fields.counsel_consulted_yes_no}</p>
<p class="sig">Signed: __________________________ &nbsp; Date: __________</p>`
  return DOC_SHELL('Internal Termination Decision Memo', body)
}

export function generateFinalPaySummaryHtml(fields: TerminationDocMergeFields): string {
  const body = `
<h1>Final Pay Summary</h1>
<p>Employee: ${fields.employee_full_name} — Last day worked: ${fields.last_day_worked}</p>
<table>
  <thead><tr><th>Item</th><th>Amount</th></tr></thead>
  <tbody>
    <tr><td>Regular wages through ${fields.last_day_worked}</td><td>${fields.regular_wages}</td></tr>
    <tr><td>Overtime owed</td><td>${fields.overtime_owed}</td></tr>
    <tr><td>Earned commissions (if any)</td><td>${fields.commissions_owed}</td></tr>
    <tr><td>Accrued unused PTO/vacation payout*</td><td>${fields.pto_payout}</td></tr>
    <tr><td>Deductions</td><td>${fields.deductions}</td></tr>
    <tr><td><strong>Net final pay</strong></td><td><strong>${fields.net_final_pay}</strong></td></tr>
  </tbody>
</table>
<p style="font-size: 13px;">* Owed unless a written forfeiture policy was communicated before the time was earned. Final pay is due on or before the next regular payday (NY Labor Law §191). Final pay date: <strong>${fields.final_pay_date}</strong>.</p>`
  return DOC_SHELL('Final Pay Summary', body)
}

export function generateExitAckHtml(fields: TerminationDocMergeFields): string {
  const body = `
<h1>Exit Acknowledgment</h1>
<p>I acknowledge that my employment with ${COMPANY_NAME} ended on ${fields.termination_date}, that I have received information about unemployment insurance and benefit continuation, and that I have returned all company property.</p>
<p class="sig">Employee: __________________________ &nbsp; Date: __________</p>`
  return DOC_SHELL('Exit Acknowledgment', body)
}

export type GeneratedTerminationDoc = {
  docType: string
  storagePath: string
  contentHtml: string
  fileName: string
}

export function generateAllTerminationDocuments(
  profile: RBTProfile,
  termination: Termination,
  decisionMaker: Pick<User, 'name' | 'email'>
): GeneratedTerminationDoc[] {
  const fields = buildMergeFields(profile, termination, decisionMaker)
  const base = `termination/${termination.id}`
  return [
    {
      docType: '195_6_NOTICE',
      storagePath: `${base}/195_6_notice.html`,
      contentHtml: generate1956NoticeHtml(fields),
      fileName: '195_6_termination_notice.html',
    },
    {
      docType: 'DECISION_MEMO',
      storagePath: `${base}/decision_memo.html`,
      contentHtml: generateDecisionMemoHtml(fields),
      fileName: 'termination_decision_memo.html',
    },
    {
      docType: 'FINAL_PAY_SUMMARY',
      storagePath: `${base}/final_pay_summary.html`,
      contentHtml: generateFinalPaySummaryHtml(fields),
      fileName: 'final_pay_summary.html',
    },
    {
      docType: 'EXIT_ACK',
      storagePath: `${base}/exit_acknowledgment.html`,
      contentHtml: generateExitAckHtml(fields),
      fileName: 'exit_acknowledgment.html',
    },
    {
      docType: 'IA_12_3',
      storagePath: `${base}/ia_12_3_slot`,
      contentHtml: `<p><strong>Form IA 12.3 — Unemployment Insurance</strong></p><p>Attach the official NYS DOL Form IA 12.3 for ${fields.employee_full_name}. Do not fabricate this form — download from the NYS Department of Labor and complete employer fields before handing to the employee.</p>`,
      fileName: 'IA_12_3_attach_slot.html',
    },
    {
      docType: 'COBRA_NOTICE',
      storagePath: `${base}/cobra_notice_slot`,
      contentHtml: `<p><strong>Health Coverage Continuation (COBRA / NY continuation)</strong></p><p>Notify your health plan administrator of the qualifying event for ${fields.employee_full_name} within 30 days. Attach the insurer/TPA COBRA election notice when received. Benefits end date: ${fields.benefits_end_date}.</p>`,
      fileName: 'cobra_notice_slot.html',
    },
  ]
}
