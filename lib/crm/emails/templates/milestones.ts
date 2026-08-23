import type { CommTemplate } from '@prisma/client'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Parent-facing onboarding milestones (not the internal CRM pipeline).
 * Adjust labels here — template mapping is below.
 */
export const PARENT_MILESTONES = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'documents', label: 'Documents' },
  { id: 'insurance', label: 'Insurance & Authorization' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'matching', label: 'Matching Your Therapist' },
  { id: 'services', label: 'Services Begin' },
] as const

export type ParentMilestoneId = (typeof PARENT_MILESTONES)[number]['id']

/**
 * Single editable map: which template lights which milestone.
 * Earlier milestones render as done; later ones muted.
 *
 * Note: CC_INTRODUCTION remains on the CommTemplate enum for DB compat
 * but is not offered in compose UI; map it to Matching if ever rendered.
 */
export const TEMPLATE_MILESTONE: Partial<Record<CommTemplate, ParentMilestoneId>> =
  {
    WELCOME: 'welcome',
    CONSENT_REQUEST: 'documents',
    DOCS_NEEDED: 'documents',
    BENEFITS_UPDATE: 'insurance',
    AUTH_APPROVED: 'insurance',
    ASSESSMENT_SCHEDULED: 'assessment',
    READY_FOR_STAFFING: 'matching',
    RBT_ASSIGNED: 'matching',
    CC_INTRODUCTION: 'matching',
    SCHEDULE_CONFIRMED: 'services',
    MEET_AND_GREET: 'services',
    SERVICES_STARTED: 'services',
  }

export function milestoneIndex(id: ParentMilestoneId): number {
  return PARENT_MILESTONES.findIndex((m) => m.id === id)
}

export function milestoneForTemplate(
  template: CommTemplate
): ParentMilestoneId | null {
  return TEMPLATE_MILESTONE[template] ?? null
}

type StepState = 'done' | 'current' | 'upcoming'

function stepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) return 'done'
  if (index === currentIndex) return 'current'
  return 'upcoming'
}

/** Compact label for narrow email columns. */
function shortLabel(label: string): string {
  if (label === 'Insurance & Authorization') return 'Insurance'
  if (label === 'Matching Your Therapist') return 'Matching'
  if (label === 'Services Begin') return 'Services'
  return label
}

function markerHtml(state: StepState): string {
  if (state === 'done') {
    return `<div style="width:22px;height:22px;line-height:22px;border-radius:50%;background:#f2652a;color:#ffffff;font-size:12px;font-weight:700;text-align:center;margin:0 auto;">&#10003;</div>`
  }
  if (state === 'current') {
    return `<div style="width:26px;height:26px;line-height:26px;border-radius:50%;background:#f2652a;border:3px solid #ffd4b8;color:#ffffff;font-size:11px;font-weight:700;text-align:center;margin:0 auto;">&#9679;</div>`
  }
  return `<div style="width:18px;height:18px;line-height:18px;border-radius:50%;background:#ffffff;border:2px solid #d4c4b4;text-align:center;margin:0 auto;">&nbsp;</div>`
}

/**
 * Email-client-safe progression tracker (table + inline styles, no JS).
 * Returns a full `<tr>` for insertion under the logo/header in the shell.
 */
export function progressionTimelineHtml(currentId: ParentMilestoneId): string {
  const currentIndex = milestoneIndex(currentId)
  if (currentIndex < 0) return ''

  const n = PARENT_MILESTONES.length
  const colWidth = `${Math.floor(100 / n)}%`

  // Connector line row (drawn behind the markers visually)
  const lineCells = PARENT_MILESTONES.map((_, i) => {
    const leftFilled = i <= currentIndex
    const rightFilled = i < currentIndex
    const isFirst = i === 0
    const isLast = i === n - 1
    const leftColor = leftFilled ? '#f2652a' : '#e8ddd0'
    const rightColor = rightFilled ? '#f2652a' : '#e8ddd0'
    return `<td width="${colWidth}" style="padding:0;font-size:0;line-height:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="height:3px;background:${isFirst ? 'transparent' : leftColor};font-size:0;line-height:0;">&nbsp;</td>
          <td width="50%" style="height:3px;background:${isLast ? 'transparent' : rightColor};font-size:0;line-height:0;">&nbsp;</td>
        </tr>
      </table>
    </td>`
  }).join('')

  const markerCells = PARENT_MILESTONES.map((m, i) => {
    const state = stepState(i, currentIndex)
    return `<td align="center" width="${colWidth}" style="padding:0;vertical-align:middle;">
      ${markerHtml(state)}
    </td>`
  }).join('')

  const labelCells = PARENT_MILESTONES.map((m, i) => {
    const state = stepState(i, currentIndex)
    const color =
      state === 'current' ? '#c45a1a' : state === 'done' ? '#2f2318' : '#a89888'
    const weight = state === 'current' ? '700' : state === 'done' ? '600' : '500'
    const here =
      state === 'current'
        ? `<div style="font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#f2652a;margin-bottom:3px;">You&rsquo;re here</div>`
        : `<div style="font-size:9px;line-height:12px;color:transparent;margin-bottom:3px;">&nbsp;</div>`
    return `<td align="center" valign="top" width="${colWidth}" style="padding:8px 3px 0;vertical-align:top;">
      ${here}
      <div style="font-size:10px;line-height:1.3;font-weight:${weight};color:${color};">${escapeHtml(shortLabel(m.label))}</div>
    </td>`
  }).join('')

  const plainSteps = PARENT_MILESTONES.map((m, i) => {
    const state = stepState(i, currentIndex)
    if (state === 'done') return `${m.label} (done)`
    if (state === 'current') return `${m.label} (you're here)`
    return m.label
  }).join(' → ')

  return `<tr>
  <td style="padding:0;background:#fffcf8;border-bottom:1px solid #f0e8df;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px 28px 18px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a7a6c;margin:0 0 14px;">Your journey with us</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>${lineCells}</tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:-12px;">
            <tr>${markerCells}</tr>
            <tr>${labelCells}</tr>
          </table>
          <p style="margin:14px 0 0;font-size:11px;line-height:1.45;color:#8a7a6c;">
            Progress: ${escapeHtml(plainSteps)}
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function progressionTimelineForTemplate(
  template: CommTemplate
): string {
  const id = milestoneForTemplate(template)
  if (!id) return ''
  return progressionTimelineHtml(id)
}
