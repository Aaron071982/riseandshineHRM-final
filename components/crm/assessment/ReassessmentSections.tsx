'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PrefilledTextArea } from '@/components/crm/assessment/PrefilledTextArea'
import type { AssessmentSectionProps } from '@/components/crm/assessment/AssessmentSectionContent'
import {
  GOAL_STATUSES,
  emptyInstrumentComparisonRow,
  emptyPeriodBarrierRow,
  type GoalStatus,
  type Reassessment,
} from '@/lib/crm/assessment/assessment.schema'
import {
  GOAL_STATUS_LABELS,
  goalProgressSummary,
  reassessmentIssues,
} from '@/lib/crm/assessment/reassessment'
import { cn } from '@/lib/utils'

const CPT_LABELS: Record<string, string> = {
  '97151': 'Behavior identification assessment (reassessment)',
  '97153': 'Adaptive behavior treatment by protocol (direct 1:1)',
  '97155': 'Protocol modification / direction of technician',
  '97156': 'Family / caregiver training',
  '97157': 'Multiple-family group caregiver training',
}

const LOCATION_KEYS = ['home', 'clinic', 'school', 'community', 'telehealth'] as const

const STATUS_TONE: Record<GoalStatus, string> = {
  MASTERED: 'border-[var(--green-fg)]/30 bg-[var(--green-bg)] text-[var(--green-fg)]',
  IN_PROGRESS: 'border-line bg-canvas text-ink',
  MODIFIED: 'border-amber-300 bg-amber-50 text-amber-900',
  DISCONTINUED: 'border-line bg-canvas text-quiet',
  NOT_INTRODUCED: 'border-dashed border-line bg-surface text-quiet',
}

function useReassessmentSetter(props: AssessmentSectionProps) {
  return <K extends keyof Reassessment>(key: K, value: Reassessment[K]) =>
    props.setSections((prev) => ({ ...prev, reassessment: { ...prev.reassessment, [key]: value } }))
}

function SubHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="border-b border-line pb-1">
      <h4 className="font-display text-sm font-semibold text-ink">{children}</h4>
      {hint && <p className="text-xs text-quiet">{hint}</p>}
    </div>
  )
}

function OnFile({ value }: { value: string }) {
  if (!value.trim()) return null
  return (
    <p className="line-clamp-2 text-[11px] text-quiet" title={value}>
      <span className="font-medium">On previous assessment:</span> {value}
    </p>
  )
}

export function ReassessmentDetailsSection(props: AssessmentSectionProps) {
  const r = props.sections.reassessment
  const prev = props.previous
  const set = useReassessmentSetter(props)
  const ro = props.readOnly
  const issues = reassessmentIssues(props.sections)

  const ct = r.caregiverTraining
  const belowMinimum = ct.sessionsDelivered !== null && ct.sessionsDelivered < ct.requiredMinimum

  return (
    <div className="space-y-8">
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-sm',
          issues.length ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-line bg-[var(--green-bg)] text-[var(--green-fg)]'
        )}
        role="status"
      >
        {issues.length === 0 ? (
          <p>✓ Reassessment checklist complete.</p>
        ) : (
          <>
            <p className="font-medium">
              ! {issues.length} checklist item{issues.length === 1 ? '' : 's'} open before this reassessment is complete
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <section className="space-y-3">
        <SubHeading>Reporting period</SubHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Period start</Label>
            <Input type="date" value={r.reportingPeriod.periodStart} readOnly={ro} onBlur={props.onBlur}
              onChange={(e) => set('reportingPeriod', { ...r.reportingPeriod, periodStart: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Period end</Label>
            <Input type="date" value={r.reportingPeriod.periodEnd} readOnly={ro} onBlur={props.onBlur}
              onChange={(e) => set('reportingPeriod', { ...r.reportingPeriod, periodEnd: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Authorization number</Label>
            <Input value={r.reportingPeriod.authorizationNumber} readOnly={ro} onBlur={props.onBlur}
              onChange={(e) => set('reportingPeriod', { ...r.reportingPeriod, authorizationNumber: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Dates of service covered</Label>
            <Input value={r.reportingPeriod.datesOfServiceCovered} readOnly={ro} onBlur={props.onBlur}
              placeholder="e.g. 04/01/2026 – 09/30/2026"
              onChange={(e) => set('reportingPeriod', { ...r.reportingPeriod, datesOfServiceCovered: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SubHeading hint="Record what changed since the previous assessment. Leave blank or write “No change” if nothing changed.">
          Changes since last assessment
        </SubHeading>
        {(
          [
            ['diagnosis', 'Diagnosis', prev ? [prev.summary.diagnosis, prev.summary.comorbidDiagnosis].filter(Boolean).join('; ') : ''],
            ['medications', 'Medications', prev?.bioPsychosocial.medications ?? ''],
            ['schoolPlacement', 'School placement', prev?.bioPsychosocial.educationalSetting ?? ''],
            ['familyCircumstances', 'Family circumstances', prev?.bioPsychosocial.familyStructure ?? ''],
            ['teamMembers', 'Team members', prev?.coordination.rows.map((c) => c.name).filter(Boolean).join(', ') ?? ''],
          ] as const
        ).map(([key, label, onFile]) => (
          <div key={key} className="space-y-1">
            <Label>{label}</Label>
            <Textarea rows={2} value={r.changesSinceLast[key]} readOnly={ro} onBlur={props.onBlur}
              onChange={(e) => set('changesSinceLast', { ...r.changesSinceLast, [key]: e.target.value })} />
            <OnFile value={onFile} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <SubHeading>Parent / caregiver training</SubHeading>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Sessions delivered this period</Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              value={ct.sessionsDelivered ?? ''}
              readOnly={ro}
              onBlur={props.onBlur}
              onChange={(e) =>
                set('caregiverTraining', {
                  ...ct,
                  sessionsDelivered: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Required minimum</Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              value={ct.requiredMinimum}
              readOnly={ro}
              onBlur={props.onBlur}
              onChange={(e) =>
                set('caregiverTraining', { ...ct, requiredMinimum: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
              }
            />
          </div>
          {ct.sessionsDelivered !== null && (
            <p
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium',
                belowMinimum ? 'bg-amber-100 text-amber-950' : 'bg-[var(--green-bg)] text-[var(--green-fg)]'
              )}
            >
              {belowMinimum
                ? `! Below minimum — ${ct.sessionsDelivered} of ${ct.requiredMinimum}`
                : `✓ Meets minimum — ${ct.sessionsDelivered} of ${ct.requiredMinimum}`}
            </p>
          )}
        </div>
        {belowMinimum && (
          <div className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Explanation (required)</Label>
              <Textarea rows={3} value={ct.belowMinimumExplanation} readOnly={ro} onBlur={props.onBlur}
                aria-invalid={!ct.belowMinimumExplanation.trim() || undefined}
                onChange={(e) => set('caregiverTraining', { ...ct, belowMinimumExplanation: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Mitigation plan (required)</Label>
              <Textarea rows={3} value={ct.mitigationPlan} readOnly={ro} onBlur={props.onBlur}
                aria-invalid={!ct.mitigationPlan.trim() || undefined}
                onChange={(e) => set('caregiverTraining', { ...ct, mitigationPlan: e.target.value })} />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label>Caregiver participation</Label>
          <Textarea rows={4} value={ct.participationNarrative} readOnly={ro} onBlur={props.onBlur}
            onChange={(e) => set('caregiverTraining', { ...ct, participationNarrative: e.target.value })} />
        </div>
      </section>

      <section className="space-y-3">
        <SubHeading hint="Prior values are carried from the previous assessment; enter this period's administration.">
          Standardized instrument comparison
        </SubHeading>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border border-line text-left text-xs">
            <thead className="bg-canvas/60">
              <tr>
                {['Instrument', 'Prior date', 'Prior result', 'Current date', 'Current result', 'Interpretation'].map((h) => (
                  <th key={h} className="p-2 font-medium text-ink">{h}</th>
                ))}
                {!ro && <th className="w-16 p-2" />}
              </tr>
            </thead>
            <tbody>
              {r.instrumentComparison.map((row) => {
                const update = (patch: Partial<typeof row>) =>
                  set('instrumentComparison', r.instrumentComparison.map((x) => (x.id === row.id ? { ...x, ...patch } : x)))
                return (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="p-1"><Input className="min-w-[110px] text-xs" value={row.instrument} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ instrument: e.target.value })} /></td>
                    <td className="p-1"><Input type="date" className="min-w-[130px] bg-canvas/60 text-xs text-quiet" value={row.priorDate} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ priorDate: e.target.value })} /></td>
                    <td className="p-1"><Textarea rows={2} className="min-w-[160px] bg-canvas/60 text-xs text-quiet" value={row.priorResult} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ priorResult: e.target.value })} /></td>
                    <td className="p-1"><Input type="date" className="min-w-[130px] text-xs" value={row.currentDate} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ currentDate: e.target.value })} /></td>
                    <td className="p-1"><Textarea rows={2} className="min-w-[160px] text-xs" value={row.currentResult} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ currentResult: e.target.value })} /></td>
                    <td className="p-1"><Textarea rows={2} className="min-w-[200px] text-xs" value={row.interpretation} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ interpretation: e.target.value })} /></td>
                    {!ro && (
                      <td className="p-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => set('instrumentComparison', r.instrumentComparison.filter((x) => x.id !== row.id))}>Remove</Button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!ro && (
          <Button type="button" variant="outline" size="sm" onClick={() => set('instrumentComparison', [...r.instrumentComparison, emptyInstrumentComparisonRow()])}>
            Add instrument
          </Button>
        )}
      </section>

      <section className="space-y-3">
        <SubHeading>Barriers encountered this period</SubHeading>
        {r.barriersDuringPeriod.length === 0 && <p className="text-xs text-quiet">No barriers recorded.</p>}
        {r.barriersDuringPeriod.map((row) => {
          const update = (patch: Partial<typeof row>) =>
            set('barriersDuringPeriod', r.barriersDuringPeriod.map((x) => (x.id === row.id ? { ...x, ...patch } : x)))
          return (
            <div key={row.id} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Barrier</Label>
                <Textarea rows={2} className="text-xs" value={row.barrier} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ barrier: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mitigation</Label>
                <Textarea rows={2} className="text-xs" value={row.mitigation} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ mitigation: e.target.value })} />
              </div>
              {!ro && (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set('barriersDuringPeriod', r.barriersDuringPeriod.filter((x) => x.id !== row.id))}>
                  Remove
                </Button>
              )}
            </div>
          )
        })}
        {!ro && (
          <Button type="button" variant="outline" size="sm" onClick={() => set('barriersDuringPeriod', [...r.barriersDuringPeriod, emptyPeriodBarrierRow()])}>
            Add barrier
          </Button>
        )}
      </section>

      <section className="space-y-3">
        <SubHeading hint="Previous request is carried from the prior assessment for reference.">
          Units requested for the next period
        </SubHeading>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border border-line text-left text-xs">
            <thead className="bg-canvas/60">
              <tr>
                {['CPT', 'Service', 'Previous request', 'Requested', 'Locations', 'Justification'].map((h) => (
                  <th key={h} className="p-2 font-medium text-ink">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.unitsRequested.map((row) => {
                const update = (patch: Partial<typeof row>) =>
                  set('unitsRequested', r.unitsRequested.map((x) => (x.code === row.code ? { ...x, ...patch } : x)))
                return (
                  <tr key={row.code} className="border-t border-line align-top">
                    <td className="p-2 font-mono">{row.code}</td>
                    <td className="p-2">{CPT_LABELS[row.code] ?? ''}</td>
                    <td className="p-2 text-quiet">{row.previousRequest || '—'}</td>
                    <td className="p-1"><Input className="w-24 text-xs" value={row.unitsRequested} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ unitsRequested: e.target.value })} /></td>
                    <td className="p-1">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {LOCATION_KEYS.map((loc) => (
                          <label key={loc} className="flex items-center gap-1 capitalize">
                            <input
                              type="checkbox"
                              checked={row.locations[loc]}
                              disabled={ro}
                              onChange={(e) => update({ locations: { ...row.locations, [loc]: e.target.checked } })}
                            />
                            {loc}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="p-1"><Textarea rows={2} className="min-w-[220px] text-xs" value={row.justification} readOnly={ro} onBlur={props.onBlur} onChange={(e) => update({ justification: e.target.value })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function ReassessmentResponseToTx(props: AssessmentSectionProps) {
  const rt = props.sections.responseToTx
  const summary = goalProgressSummary(props.sections)
  const set = (patch: Partial<typeof rt>) =>
    props.setSections((prev) => ({ ...prev, responseToTx: { ...prev.responseToTx, ...patch } }))

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">
          Goal progress this period <span className="font-normal text-quiet">({summary.total} goals, from goal statuses)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {GOAL_STATUSES.map((s) => (
            <span key={s} className={cn('rounded-md border px-2 py-1 text-xs font-medium', STATUS_TONE[s])}>
              {GOAL_STATUS_LABELS[s]}: {summary.counts[s]}
            </span>
          ))}
          {summary.unset > 0 && (
            <span className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950">
              ! No status: {summary.unset}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['MASTERED', 'IN_PROGRESS', 'MODIFIED', 'DISCONTINUED'] as const).map((s) => (
            <div key={s} className="rounded-lg border border-line p-2">
              <p className="text-xs font-semibold text-ink">{GOAL_STATUS_LABELS[s]}</p>
              {summary.lists[s].length === 0 ? (
                <p className="text-xs text-quiet">None</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {summary.lists[s].map((g, i) => (
                    <li key={i}>
                      <span className="text-quiet">{g.table}:</span> {g.name}
                      {s === 'MASTERED' && g.dateMastered && <span className="text-quiet"> · {g.dateMastered}</span>}
                      {(s === 'MODIFIED' || s === 'DISCONTINUED') && (
                        <span className={g.rationale ? 'text-quiet' : 'font-medium text-[var(--urgent-fg)]'}>
                          {' '}— {g.rationale || 'rationale missing'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
      <PrefilledTextArea
        label="Response to treatment"
        value={rt.narrative}
        previousValue={props.previous?.responseToTx.narrative}
        onChange={(v) => set({ narrative: v })}
        readOnly={props.readOnly}
        onBlur={props.onBlur}
        rows={6}
      />
      <PrefilledTextArea
        label="Rationale for lack of progress, regression, or stagnation"
        value={rt.lackOfProgressRationale}
        onChange={(v) => set({ lackOfProgressRationale: v })}
        readOnly={props.readOnly}
        onBlur={props.onBlur}
        rows={4}
      />
    </div>
  )
}
