import type { StaffEmailContent, StaffMergeFields } from './types'
import { BCBA_ASSIGNED_ALLOTMENT_NOTE } from './bcbaAssignedBoilerplate'
import { escapeHtml, infoBlock, para, staffSignature } from './shell'

function bcbaGreeting(fields: StaffMergeFields): string {
  const name = fields.bcbaName?.trim()
  if (!name) return 'Hi,'
  return `Dear ${escapeHtml(name)},`
}

function approvedHoursBlock(fields: StaffMergeFields): string {
  const text = fields.bcbaAssignmentApprovedHoursText?.trim()
  if (text) {
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => escapeHtml(line))
    if (lines.length) {
      return infoBlock(
        'Approved hours (CPT)',
        lines.map((line) => `<strong>${line}</strong>`)
      )
    }
  }

  const rows = fields.approvedHoursByCpt ?? []
  if (!rows.length) {
    return para(
      '<em>Approved hours by CPT have not been entered yet — please fill them in before sending.</em>'
    )
  }
  const body = rows
    .map(
      (row) => `<tr>
      <td style="padding:8px 10px;border:1px solid #d8d0c8;font-size:14px;">${escapeHtml(row.cptCode)}</td>
      <td style="padding:8px 10px;border:1px solid #d8d0c8;font-size:14px;">${escapeHtml(row.label)}</td>
      <td style="padding:8px 10px;border:1px solid #d8d0c8;font-size:14px;">${escapeHtml(row.hoursOrUnits)}</td>
    </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
    <tr style="background:#f7f0e8;">
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a7a6c;">CPT</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a7a6c;">Service</th>
      <th align="left" style="padding:8px 10px;border:1px solid #d8d0c8;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8a7a6c;">Approved</th>
    </tr>
    ${body}
  </table>`
}

export function renderBcbaAssigned(fields: StaffMergeFields): StaffEmailContent {
  const clientName =
    fields.bcbaAssignmentClientName?.trim() ||
    `${fields.childFirstName} ${fields.childLastName}`.trim() ||
    'the client'
  const dob = fields.bcbaAssignmentDateOfBirth?.trim() || fields.childDateOfBirth || '—'
  const serviceDates =
    fields.bcbaAssignmentServiceDates?.trim() ||
    fields.authServiceDates ||
    fields.startDate ||
    '—'

  return {
    subject: `Case assigned — ${clientName} approved to begin ABA services`,
    bodyHtml: `
      ${para(bcbaGreeting(fields))}
      ${para(
        `The following client has been assigned to you and has been approved to begin ABA services.`
      )}
      ${infoBlock('Client details', [
        `Client name: <strong>${escapeHtml(clientName)}</strong>`,
        `Date of birth: <strong>${escapeHtml(dob)}</strong>`,
        `Service dates: <strong>${escapeHtml(serviceDates)}</strong>`,
      ])}
      ${approvedHoursBlock(fields)}
      ${para(escapeHtml(BCBA_ASSIGNED_ALLOTMENT_NOTE))}
      ${staffSignature(fields)}
    `,
  }
}
