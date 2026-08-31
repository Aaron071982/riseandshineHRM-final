import type { StaffEmailContent, StaffMergeFields } from './types'
import {
  CASE_COORDINATION_BILLING_GUIDELINES,
  CASE_COORDINATION_CLINICAL_COMPLIANCE,
  CASE_COORDINATION_CONTACT_EMAIL,
  CASE_COORDINATION_CONTACT_PROMPT,
  CASE_COORDINATION_INTRO,
  CASE_COORDINATION_POLICY_INTRO,
  CASE_COORDINATION_POLICY_ITEMS,
} from '@/lib/crm/caseCoordination/boilerplate'
import { formatScheduleForBt } from '@/lib/crm/caseCoordination/scheduleString'
import { escapeHtml, para } from './shell'
import { contactBlock, emailGuideSection, formatClientAddress } from './helpers'

function groupBtRows(fields: StaffMergeFields) {
  const byName = new Map<
    string,
    { name: string; slots: { dayOfWeek: number; startTime: string; endTime: string }[] }
  >()
  for (const slot of fields.scheduleSlots) {
    const name = slot.rbtName.trim() || 'Behavior Technician'
    const row = byName.get(name) ?? { name, slots: [] }
    row.slots.push({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })
    byName.set(name, row)
  }
  return [...byName.values()]
}

function btTableHtml(fields: StaffMergeFields): string {
  const rows = groupBtRows(fields)
  if (!rows.length) {
    return `<p style="margin:8px 0;font-style:italic;color:#6b5e54;">Not yet assigned</p>`
  }
  const body = rows
    .map((row) => {
      const schedule = formatScheduleForBt(row.slots) || 'Not yet assigned'
      const contact =
        row.name === fields.rbtName?.trim()
          ? [fields.rbtPhone, fields.rbtEmail].filter(Boolean).join(' · ')
          : ''
      return `<tr>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(row.name)}</td>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(contact || '—')}</td>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(schedule)}</td>
        <td style="padding:8px 10px;border:1px solid #d8d0c8;">${escapeHtml(fields.startDate ?? 'Not yet assigned')}</td>
      </tr>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
    <tr style="background:#e6f7f5;">
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Behavior Technician</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Phone Number/Email</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Schedule</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;">Start Date</th>
    </tr>
    ${body}
  </table>`
}

export function renderCaseCoordination(fields: StaffMergeFields): StaffEmailContent {
  const clientName = `${fields.childFirstName} ${fields.childLastName}`.trim()
  const address = formatClientAddress(fields)

  const clientBlock = contactBlock('Client Information', [
    { label: 'Client Name', value: clientName },
    { label: 'Service Address', value: address },
    { label: 'Parent/Guardian Name', value: fields.parentName },
    { label: 'Parent Email Address', value: fields.parentEmail },
    { label: 'Parent Contact Number', value: fields.parentPhone },
  ])

  const bcbaBlock = contactBlock('Supervising BCBA Information', [
    { label: 'BCBA Name', value: fields.bcbaName },
    { label: 'Contact Number', value: fields.bcbaPhone },
    { label: 'Email Address', value: fields.bcbaEmail },
  ])

  const coordinatorBlock = contactBlock('Case Coordinator Information', [
    { label: 'Name', value: fields.coordinatorName },
    { label: 'Contact Number', value: fields.coordinatorPhone },
    { label: 'Email Address', value: fields.coordinatorEmail },
  ])

  const billingHtml = `<ul style="margin:8px 0 0;padding-left:18px;">${CASE_COORDINATION_BILLING_GUIDELINES.map(
    (item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`
  ).join('')}</ul>`

  const policyHtml = `<p style="margin:0 0 8px;">${escapeHtml(CASE_COORDINATION_POLICY_INTRO)}</p>
    <ul style="margin:0;padding-left:18px;">${CASE_COORDINATION_POLICY_ITEMS.map(
      (item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`
    ).join('')}</ul>`

  const complianceHtml = `${para(CASE_COORDINATION_CLINICAL_COMPLIANCE)}
    ${para(`${CASE_COORDINATION_CONTACT_PROMPT} ${CASE_COORDINATION_CONTACT_EMAIL}`)}`

  return {
    subject: `Case coordination — ${clientName}`,
    bodyHtml: `
      ${para('Dear Team,')}
      ${para(CASE_COORDINATION_INTRO)}
      ${emailGuideSection('CLIENT INFORMATION', clientBlock)}
      ${emailGuideSection('SUPERVISING BCBA INFORMATION', bcbaBlock)}
      ${emailGuideSection('BEHAVIOR TECHNICIAN INFORMATION', btTableHtml(fields))}
      ${emailGuideSection('CASE COORDINATOR INFORMATION', coordinatorBlock)}
      ${emailGuideSection('BILLING & SESSION GUIDELINES', billingHtml)}
      ${emailGuideSection('POLICY REMINDER', policyHtml)}
      ${emailGuideSection('CLINICAL COMPLIANCE STATEMENT', complianceHtml)}
    `,
  }
}

export function caseCoordinationTeamCcEmails(fields: StaffMergeFields): string[] {
  return fields.teamStaffEmails ?? []
}
