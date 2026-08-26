import {
  BODY_TEXT,
  COMPANY_NAME,
  MUTED_TEXT,
  RULE,
  escapeHtml,
  para,
  sectionRule,
  wrapStaffEmail,
  htmlToPlainText,
} from './shell'

export type WeeklyActivityRow = {
  date: string
  sender: string
  recipient: string
  template: string
  stageAtSend: string
}

export type WeeklyPendingFollowup = {
  clientLabel: string
  note: string
}

export type WeeklyActivitySummaryFields = {
  weekRange: string
  sentCount: number
  activityRows: WeeklyActivityRow[]
  pendingFollowups: WeeklyPendingFollowup[]
  recipientList: string[]
}

function activityTableHtml(rows: WeeklyActivityRow[]): string {
  if (!rows.length) {
    return para(`<em>No client-facing emails were recorded this week.</em>`)
  }
  const body = rows
    .map(
      (r) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${RULE};font-size:13px;color:${BODY_TEXT};">${escapeHtml(r.date)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${RULE};font-size:13px;color:${BODY_TEXT};">${escapeHtml(r.sender)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${RULE};font-size:13px;color:${BODY_TEXT};">${escapeHtml(r.recipient)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${RULE};font-size:13px;color:${BODY_TEXT};">${escapeHtml(r.template)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${RULE};font-size:13px;color:${BODY_TEXT};">${escapeHtml(r.stageAtSend)}</td>
    </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border:1px solid ${RULE};border-radius:8px;overflow:hidden;">
  <tr>
    <th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};border-bottom:1px solid ${RULE};">Date</th>
    <th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};border-bottom:1px solid ${RULE};">Sender</th>
    <th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};border-bottom:1px solid ${RULE};">Recipient</th>
    <th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};border-bottom:1px solid ${RULE};">Template</th>
    <th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED_TEXT};border-bottom:1px solid ${RULE};">Stage</th>
  </tr>
  ${body}
</table>`
}

function pendingFollowupsHtml(rows: WeeklyPendingFollowup[]): string {
  if (!rows.length) {
    return para(`Nothing is flagged as awaiting follow-up right now.`)
  }
  const lis = rows
    .map(
      (r) =>
        `<li style="margin:0 0 10px;line-height:1.5;color:${BODY_TEXT};"><strong>${escapeHtml(r.clientLabel)}</strong> — ${escapeHtml(r.note)}</li>`
    )
    .join('')
  return `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;">${lis}</ul>`
}

/**
 * INTERNAL ops digest — not offered in the parent Email tab.
 * Powered by Operations → Email Activity (when that report ships).
 */
export function renderWeeklyActivitySummary(
  fields: WeeklyActivitySummaryFields
): { subject: string; html: string; text: string } {
  const recipients =
    fields.recipientList.length > 0
      ? fields.recipientList.map(escapeHtml).join(', ')
      : 'ops / leadership list'

  const bodyHtml = `
    ${para(`Team,`)}
    ${para(`Here is the weekly summary of client-facing email activity across the CRM for the week of <strong>${escapeHtml(fields.weekRange)}</strong>. This is a record of what went out, who sent it, and who received it — so everyone has one clear picture of where communication stands and nothing quietly falls through.`)}
    ${para(`<strong>Total client emails sent this week:</strong> ${fields.sentCount}`)}
    ${sectionRule('Activity')}
    ${activityTableHtml(fields.activityRows)}
    ${sectionRule('Still awaiting a follow-up or a family response')}
    ${pendingFollowupsHtml(fields.pendingFollowups)}
    ${para(`The full, filterable log lives in the Operations → Email Activity report, where you can narrow by sender, template, date range, or individual client.`)}
    ${para(`— ${COMPANY_NAME} HRM (automated summary)<br /><span style="color:${MUTED_TEXT};font-size:13px;">Distributed to: ${recipients}</span>`)}
  `

  const html = wrapStaffEmail(bodyHtml, { internal: true })
  return {
    subject: `Rise & Shine — Client Email Activity, week of ${fields.weekRange}`,
    html,
    text: htmlToPlainText(html),
  }
}
