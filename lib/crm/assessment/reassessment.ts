import {
  DEFAULT_CAREGIVER_TRAINING_MINIMUM,
  GOAL_STATUSES,
  REASSESSMENT_CPT_CODES,
  REASSESSMENT_INSTRUMENTS,
  emptyInstrumentComparisonRow,
  reassessmentSchema,
  unitsRequestRowSchema,
  type AssessmentSectionData,
  type AssessmentSectionKey,
  type GoalRowColumnA,
  type GoalRowColumnB,
  type GoalStatus,
  type Reassessment,
} from '@/lib/crm/assessment/assessment.schema'

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  MASTERED: 'Mastered',
  IN_PROGRESS: 'In Progress',
  MODIFIED: 'Modified',
  DISCONTINUED: 'Discontinued',
  NOT_INTRODUCED: 'Not Introduced',
}

export const RATIONALE_REQUIRED_STATUSES: readonly GoalStatus[] = ['MODIFIED', 'DISCONTINUED']

/** Initial-assessment boilerplate opens with this; it must not survive into a reassessment. */
const INITIAL_ONLY_MARKER = 'this is an initial assessment'

export function containsInitialOnlyText(text: string): boolean {
  return text.toLowerCase().includes(INITIAL_ONLY_MARKER)
}

export function goalRequiresRationale(status: string): boolean {
  return (RATIONALE_REQUIRED_STATUSES as readonly string[]).includes(status)
}

/** Stable deep equality for JSON-shaped section data. */
export function sameValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

// ---------------------------------------------------------------------------
// Goal tables
// ---------------------------------------------------------------------------

export type GoalTableRef = {
  key: string
  label: string
  variant: 'A' | 'B'
  rows: GoalRowColumnA[] | GoalRowColumnB[]
}

export function goalTables(sections: AssessmentSectionData): GoalTableRef[] {
  const g = sections.goals
  const pt = sections.parentTraining
  return [
    { key: 'behaviorReduction', label: 'Behavior Reduction', variant: 'A', rows: g.behaviorReduction.rows },
    { key: 'replacementBehavior', label: 'Replacement Behavior', variant: 'A', rows: g.replacementBehavior.rows },
    { key: 'communication', label: 'Communication', variant: 'A', rows: g.communication.rows },
    { key: 'social', label: 'Social', variant: 'A', rows: g.social.rows },
    { key: 'adaptive', label: 'Adaptive', variant: 'A', rows: g.adaptive.rows },
    { key: 'livingSelfHelp', label: 'Living / Self-Help', variant: 'A', rows: g.livingSelfHelp.rows },
    { key: 'parentSummary', label: 'Parent Training', variant: 'B', rows: pt.summaryGoals },
    { key: 'parentGroup', label: 'Group Parent Training', variant: 'B', rows: pt.groupGoals },
  ]
}

export function goalRowName(row: GoalRowColumnA | GoalRowColumnB): string {
  if ('goalName' in row) return row.goalName.trim() || row.objective.trim()
  return row.goal.trim()
}

function isBlankGoalRow(row: GoalRowColumnA | GoalRowColumnB): boolean {
  return !goalRowName(row) && !row.masteryCriteria.trim()
}

export type GoalProgressEntry = { table: string; name: string; rationale: string; dateMastered: string }

export type GoalProgressSummary = {
  total: number
  unset: number
  counts: Record<GoalStatus, number>
  lists: Record<GoalStatus, GoalProgressEntry[]>
}

export function goalProgressSummary(sections: AssessmentSectionData): GoalProgressSummary {
  const counts = Object.fromEntries(GOAL_STATUSES.map((s) => [s, 0])) as Record<GoalStatus, number>
  const lists = Object.fromEntries(GOAL_STATUSES.map((s) => [s, []])) as unknown as Record<
    GoalStatus,
    GoalProgressEntry[]
  >
  let total = 0
  let unset = 0
  for (const table of goalTables(sections)) {
    for (const row of table.rows) {
      if (isBlankGoalRow(row)) continue
      total += 1
      if (!row.status) {
        unset += 1
        continue
      }
      counts[row.status] += 1
      lists[row.status].push({
        table: table.label,
        name: goalRowName(row) || 'Untitled goal',
        rationale: row.rationale,
        dateMastered: row.dateMastered,
      })
    }
  }
  return { total, unset, counts, lists }
}

function carryGoalRowA(row: GoalRowColumnA): GoalRowColumnA {
  return {
    ...row,
    previousAssessmentScore: row.currentPerformance,
    currentPerformance: '',
    ...carriedProgress(row),
  }
}

function carryGoalRowB(row: GoalRowColumnB): GoalRowColumnB {
  return {
    ...row,
    previousAssessmentPerformance: row.currentPerformance,
    currentPerformance: '',
    ...carriedProgress(row),
  }
}

/** Terminal outcomes stay recorded; everything else needs a fresh status for the new period. */
function carriedProgress(row: GoalRowColumnA | GoalRowColumnB) {
  if (row.status === 'MASTERED') {
    return { status: 'MASTERED' as const, dateMastered: row.dateMastered, rationale: '' }
  }
  if (row.status === 'DISCONTINUED') {
    return { status: 'DISCONTINUED' as const, dateMastered: '', rationale: row.rationale }
  }
  return { status: '' as const, dateMastered: '', rationale: '' }
}

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

const TREATMENT_REQUEST_BY_CODE: Record<
  (typeof REASSESSMENT_CPT_CODES)[number],
  keyof AssessmentSectionData['treatmentRequest']
> = {
  '97151': 'hrs97151',
  '97153': 'hrs97153Initial',
  '97155': 'hrs97155Initial',
  '97156': 'hrs97156',
  '97157': 'hrs97157',
}

function priorInstrumentFromInitial(
  instrument: string,
  prev: AssessmentSectionData
): { date: string; result: string } {
  const pl = prev.presentLevels
  switch (instrument) {
    case 'Vineland-3':
      return {
        date: pl.vineland.date || prev.instruments.vinelandCompletedDate,
        result: pl.vineland.interpretation,
      }
    case 'AFLS':
      return { date: '', result: pl.afls.interpretation || prev.instruments.aflsAssessment }
    case 'FAST':
      return { date: pl.fast.date, result: pl.fast.interpretation || prev.instruments.fastAssessment }
    default:
      return { date: '', result: '' }
  }
}

export function buildReassessmentSection(
  prev: AssessmentSectionData,
  opts: { previousWasReassessment: boolean; previousReportDate: string }
): Reassessment {
  const prevRe = opts.previousWasReassessment ? prev.reassessment : null

  const instrumentComparison = REASSESSMENT_INSTRUMENTS.map((instrument) => {
    const row = emptyInstrumentComparisonRow(instrument)
    const prevRow = prevRe?.instrumentComparison.find((r) => r.instrument === instrument)
    if (prevRow) {
      const useCurrent = Boolean(prevRow.currentDate || prevRow.currentResult.trim())
      row.priorDate = useCurrent ? prevRow.currentDate : prevRow.priorDate
      row.priorResult = useCurrent ? prevRow.currentResult : prevRow.priorResult
    } else if (!prevRe) {
      const prior = priorInstrumentFromInitial(instrument, prev)
      row.priorDate = prior.date
      row.priorResult = prior.result
    }
    return row
  })

  const unitsRequested = REASSESSMENT_CPT_CODES.map((code) => {
    const prevRow = prevRe?.unitsRequested.find((r) => r.code === code)
    return unitsRequestRowSchema.parse({
      code,
      previousRequest: prevRow
        ? prevRow.unitsRequested
        : prev.treatmentRequest[TREATMENT_REQUEST_BY_CODE[code]],
      locations: prevRow ? prevRow.locations : prev.locationSchedule.primaryLocations,
    })
  })

  return reassessmentSchema.parse({
    reportingPeriod: {
      periodStart: prevRe ? prevRe.reportingPeriod.periodEnd : opts.previousReportDate,
    },
    caregiverTraining: {
      requiredMinimum: prevRe?.caregiverTraining.requiredMinimum ?? DEFAULT_CAREGIVER_TRAINING_MINIMUM,
    },
    instrumentComparison,
    unitsRequested,
  })
}

/**
 * Builds the sections of a new reassessment from its predecessor. Pure: the
 * predecessor object is never mutated. Signatures, report dates and
 * per-period answers are reset; plan content is carried forward.
 */
export function buildReassessmentClone(
  prev: AssessmentSectionData,
  opts: { previousWasReassessment: boolean; previousReportDate: string }
): AssessmentSectionData {
  const next = structuredClone(prev)

  next.summary.reportDate = ''

  for (const key of ['behaviorReduction', 'replacementBehavior', 'communication', 'social', 'adaptive', 'livingSelfHelp'] as const) {
    next.goals[key].rows = next.goals[key].rows.map(carryGoalRowA)
  }
  next.parentTraining.summaryGoals = next.parentTraining.summaryGoals.map(carryGoalRowB)
  next.parentTraining.groupGoals = next.parentTraining.groupGoals.map(carryGoalRowB)

  next.responseToTx = {
    narrative: containsInitialOnlyText(next.responseToTx.narrative) ? '' : next.responseToTx.narrative,
    lackOfProgressRationale: '',
  }

  next.transitionPlan.reviewedThisPeriod = false
  next.transitionPlan.reviewedOn = ''
  next.transitionPlan.reviewNotes = ''

  const clearSig = (entry: typeof next.signatures.bcba) => ({
    ...entry,
    signatureData: '',
    signatureTypedName: '',
    date: '',
  })
  next.signatures = {
    bcba: clearSig(next.signatures.bcba),
    graduatePermit: clearSig(next.signatures.graduatePermit),
    parentGuardian: clearSig(next.signatures.parentGuardian),
  }

  next.reassessment = buildReassessmentSection(prev, opts)
  return next
}

// ---------------------------------------------------------------------------
// Completion checklist
// ---------------------------------------------------------------------------

export type ReassessmentIssue = { section: AssessmentSectionKey; message: string }

export function reassessmentIssues(sections: AssessmentSectionData): ReassessmentIssue[] {
  const issues: ReassessmentIssue[] = []
  const re = sections.reassessment
  const rp = re.reportingPeriod

  if (!rp.periodStart || !rp.periodEnd) {
    issues.push({ section: 'reassessment', message: 'Reporting period start and end dates are required.' })
  } else if (rp.periodEnd < rp.periodStart) {
    issues.push({ section: 'reassessment', message: 'Reporting period ends before it starts.' })
  }

  const ct = re.caregiverTraining
  if (ct.sessionsDelivered === null) {
    issues.push({ section: 'reassessment', message: 'Enter the number of caregiver training sessions delivered.' })
  } else if (ct.sessionsDelivered < ct.requiredMinimum) {
    if (!ct.belowMinimumExplanation.trim() || !ct.mitigationPlan.trim()) {
      issues.push({
        section: 'reassessment',
        message: `Caregiver training is below the minimum (${ct.sessionsDelivered} of ${ct.requiredMinimum}): an explanation and mitigation plan are required.`,
      })
    }
  }

  let unsetStatus = 0
  for (const table of goalTables(sections)) {
    for (const row of table.rows) {
      if (isBlankGoalRow(row)) continue
      if (!row.status) unsetStatus += 1
      if (goalRequiresRationale(row.status) && !row.rationale.trim()) {
        issues.push({
          section: table.variant === 'A' ? 'goals' : 'parentTraining',
          message: `${table.label}: "${goalRowName(row) || 'Untitled goal'}" is ${GOAL_STATUS_LABELS[row.status as GoalStatus]} without a rationale.`,
        })
      }
    }
  }
  if (unsetStatus > 0) {
    issues.push({
      section: 'goals',
      message: `${unsetStatus} goal${unsetStatus === 1 ? ' has' : 's have'} no status for this period.`,
    })
  }

  if (!sections.responseToTx.narrative.trim()) {
    issues.push({ section: 'responseToTx', message: 'Response to treatment narrative is empty.' })
  }

  if (!sections.transitionPlan.reviewedThisPeriod) {
    issues.push({ section: 'transitionPlan', message: 'Transition / discharge criteria have not been marked as reviewed this period.' })
  }

  const initialOnly: [AssessmentSectionKey, string, string][] = [
    ['responseToTx', 'Response to treatment', sections.responseToTx.narrative],
    ['interventions', '97155 interventions', sections.interventions.narrative],
    ['goals', 'Analysis of behavior progress', sections.goals.behaviorReduction.analysisNarrative],
  ]
  for (const [section, label, text] of initialOnly) {
    if (containsInitialOnlyText(text)) {
      issues.push({ section, message: `${label} still contains initial-assessment wording ("This is an initial assessment…").` })
    }
  }

  return issues
}
