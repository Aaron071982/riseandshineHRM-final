import { DAY_LABELS, formatTime12h } from '@/lib/rbt-schedule/utils'
import type { StaffMergeFields, ScheduleSlotRow } from './types'
import { escapeHtml } from './shell'

export function childInitialLast(fields: {
  childFirstName: string
  childLastName: string
}): string {
  const first = fields.childFirstName.trim()
  const last = fields.childLastName.trim()
  if (!first && !last) return 'your child'
  const initial = first ? `${first[0]!.toUpperCase()}.` : ''
  return last ? `${initial} ${last}`.trim() : initial || first
}

export function childName(fields: { childFirstName: string }): string {
  return fields.childFirstName.trim() || 'your child'
}

export function formatClientAddress(fields: StaffMergeFields): string | null {
  const parts = [
    fields.clientAddressLine,
    [fields.clientCity, fields.clientState].filter(Boolean).join(', '),
    fields.clientZip,
  ].filter((p) => p?.trim())
  return parts.length ? parts.join(', ') : null
}

export function formatRbtAddress(fields: StaffMergeFields): string | null {
  const parts = [
    fields.rbtAddressLine,
    [fields.rbtCity, fields.rbtState].filter(Boolean).join(', '),
    fields.rbtZip,
  ].filter((p) => p?.trim())
  return parts.length ? parts.join(', ') : null
}

/** Email-safe schedule table for SCHEDULE_CONFIRMED. */
export function scheduleTable(slots: ScheduleSlotRow[]): string {
  if (!slots.length) {
    return `<p style="margin:16px 0;font-size:14px;color:#6b5e52;font-style:italic;">No sessions are on file yet — we will confirm your schedule separately.</p>`
  }
  const rows = slots
    .map((s) => {
      const day = DAY_LABELS[s.dayOfWeek] ?? 'Day'
      const time = `${formatTime12h(s.startTime)} – ${formatTime12h(s.endTime)}`
      return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #ebe3da;font-size:14px;color:#2f2318;">${escapeHtml(day)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #ebe3da;font-size:14px;color:#2f2318;">${escapeHtml(time)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #ebe3da;font-size:14px;color:#2f2318;">${escapeHtml(s.rbtName)}</td>
      </tr>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #ebe3da;border-radius:10px;overflow:hidden;background:#fffcf8;">
    <tr style="background:#f7f0e8;">
      <th align="left" style="padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a7a6c;border-bottom:1px solid #ebe3da;">Day</th>
      <th align="left" style="padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a7a6c;border-bottom:1px solid #ebe3da;">Time</th>
      <th align="left" style="padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a7a6c;border-bottom:1px solid #ebe3da;">Therapist</th>
    </tr>
    ${rows}
  </table>`
}

export function contactBlock(
  title: string,
  lines: { label: string; value: string | null | undefined }[]
): string {
  const filled = lines.filter((l) => l.value?.trim())
  if (!filled.length) return ''
  const rows = filled
    .map(
      (l) =>
        `<tr><td style="padding:4px 0;font-size:13px;color:#8a7a6c;width:88px;vertical-align:top;">${escapeHtml(l.label)}</td><td style="padding:4px 0;font-size:14px;color:#2f2318;">${escapeHtml(l.value!.trim())}</td></tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;">
    <tr><td style="font-size:13px;font-weight:700;color:#2f2318;margin-bottom:6px;padding-bottom:6px;">${escapeHtml(title)}</td></tr>
    <tr><td><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  </table>`
}
