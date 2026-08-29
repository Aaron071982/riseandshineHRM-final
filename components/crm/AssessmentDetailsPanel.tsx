'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AssessmentArtifactType } from '@prisma/client'
import { AlertTriangle, Loader2, Save } from 'lucide-react'
import { saveClinicalAssessmentDetails } from '@/lib/crm/clinicalAssessment/actions'
import { ASSESSMENT_ARTIFACT_LABELS } from '@/lib/crm/clinicalAssessment/artifacts.shared'
import {
  DEFAULT_DIAGNOSIS,
  GOAL_AREA_OPTIONS,
  RISK_FACTOR_OPTIONS,
  SERVICE_LOCATION_OPTIONS,
  assessmentDetailsHasSafetyFlags,
  formatDetailDate,
  groupHasContent,
  type AssessmentDetailsInput,
  type AssessmentDetailsRecord,
} from '@/lib/crm/clinicalAssessment/details.shared'
import { calendarDateKey } from '@/lib/billing/calendarDate'
import { cn } from '@/lib/utils'

type GraphArtifact = {
  id: string
  artifactType: AssessmentArtifactType
  contentType: string
}

function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return calendarDateKey(d)
}

function recordToForm(d: AssessmentDetailsRecord | null): AssessmentDetailsInput {
  if (!d) return { diagnosis: DEFAULT_DIAGNOSIS }
  return {
    patientName: d.patientName,
    dob: toInputDate(d.dob),
    age: d.age,
    diagnosis: d.diagnosis ?? DEFAULT_DIAGNOSIS,
    comorbidDiagnosis: d.comorbidDiagnosis,
    reportDate: toInputDate(d.reportDate),
    assessorName: d.assessorName,
    assessorCredentials: d.assessorCredentials,
    referringProvider: d.referringProvider,
    npi: d.npi,
    hrs97151: d.hrs97151,
    hrs97153: d.hrs97153,
    hrs97155: d.hrs97155,
    hrs97156: d.hrs97156,
    hrs97157: d.hrs97157,
    servicePeriod: d.servicePeriod,
    locations: d.locations,
    reasonForAssessment: d.reasonForAssessment,
    interferingBehaviors: d.interferingBehaviors,
    targetBehavior1: d.targetBehavior1,
    targetBehavior2: d.targetBehavior2,
    targetBehavior3: d.targetBehavior3,
    medications: d.medications,
    allergies: d.allergies,
    reassessmentDate: toInputDate(d.reassessmentDate),
    riskFactors: d.riskFactors,
    riskFactorsOther: d.riskFactorsOther,
    vinelandDate: toInputDate(d.vinelandDate),
    atecDate: toInputDate(d.atecDate),
    fastDate: toInputDate(d.fastDate),
    vinelandCommScore: d.vinelandCommScore,
    vinelandSocScore: d.vinelandSocScore,
    goalAreas: d.goalAreas,
    speech: d.speech,
    ot: d.ot,
    pt: d.pt,
    teacher: d.teacher,
    pcp: d.pcp,
    bcbaName: d.bcbaName,
    bcbaDate: toInputDate(d.bcbaDate),
    parentName: d.parentName,
    parentDate: toInputDate(d.parentDate),
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-quiet">{label}</span>
      {children}
    </label>
  )
}

function inputClass(disabled: boolean) {
  return cn(
    'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink',
    disabled && 'cursor-not-allowed opacity-70'
  )
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null
  return (
    <div>
      <dt className="text-xs font-medium text-quiet">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{value}</dd>
    </div>
  )
}

function CheckboxGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={value.includes(opt)}
            disabled={disabled}
            onChange={(e) => {
              if (e.target.checked) onChange([...value, opt])
              else onChange(value.filter((v) => v !== opt))
            }}
            className="h-4 w-4 rounded border-line"
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

function GraphInline({
  clientId,
  artifact,
}: {
  clientId: string
  artifact: GraphArtifact
}) {
  const isPdf = artifact.contentType.toLowerCase().includes('pdf')
  const src = `/api/client-services/clients/${clientId}/clinical-assessment/artifacts/${artifact.id}/graph`

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-medium text-ink">
        {ASSESSMENT_ARTIFACT_LABELS[artifact.artifactType]}
      </p>
      {isPdf ? (
        <iframe
          title={ASSESSMENT_ARTIFACT_LABELS[artifact.artifactType]}
          src={`/api/client-services/clients/${clientId}/clinical-assessment/artifacts/${artifact.id}/download?inline=1&branded=1`}
          className="mt-2 h-80 w-full rounded border border-line bg-white"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={ASSESSMENT_ARTIFACT_LABELS[artifact.artifactType]}
          className="mt-2 max-h-96 w-full rounded border border-line object-contain bg-white"
        />
      )}
    </div>
  )
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-quiet">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="space-y-3 border-t border-line px-3 py-3">{children}</div>}
    </section>
  )
}

export function AssessmentDetailsPanel({
  clientId,
  assessmentId,
  details,
  graphArtifacts,
  canEdit,
  isDraft,
}: {
  clientId: string
  assessmentId: string
  details: AssessmentDetailsRecord | null
  graphArtifacts: GraphArtifact[]
  canEdit: boolean
  isDraft: boolean
}) {
  const router = useRouter()
  const editable = canEdit && isDraft
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<AssessmentDetailsInput>(() => recordToForm(details))

  useEffect(() => {
    setForm(recordToForm(details))
  }, [details])

  const viewRecord = details

  const showSafety = assessmentDetailsHasSafetyFlags(viewRecord)
  const hasAnyContent =
    editable ||
    showSafety ||
    groupHasContent('client', viewRecord) ||
    groupHasContent('services', viewRecord) ||
    groupHasContent('clinical', viewRecord) ||
    groupHasContent('instruments', viewRecord) ||
    groupHasContent('goals', viewRecord) ||
    groupHasContent('careTeam', viewRecord) ||
    groupHasContent('signOff', viewRecord) ||
    graphArtifacts.length > 0

  const setField = <K extends keyof AssessmentDetailsInput>(
    key: K,
    value: AssessmentDetailsInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const onSave = () => {
    startTransition(async () => {
      setError('')
      setSaved(false)
      const res = await saveClinicalAssessmentDetails(clientId, assessmentId, form)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  if (!editable && !hasAnyContent) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">Key details</h3>
        <p className="mt-1 text-sm text-quiet">No snapshot entered for this version.</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Key details</h3>
          <p className="mt-1 text-sm text-quiet">
            Curated snapshot for staffing and placement. All fields optional — partial saves are
            fine and never block lock.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            disabled={pending}
            onClick={onSave}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save snapshot
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-3 text-sm text-[var(--green)]">Snapshot saved.</p>
      )}

      <div className="mt-4 space-y-3">
        {(showSafety || editable) && (
          <Section
            title="Safety flags"
            defaultOpen={showSafety || editable}
          >
            {editable ? (
              <>
                <CheckboxGroup
                  options={RISK_FACTOR_OPTIONS}
                  value={form.riskFactors ?? []}
                  onChange={(v) => setField('riskFactors', v)}
                  disabled={pending}
                />
                {(form.riskFactors ?? []).includes('Other') && (
                  <Field label="Other risk detail">
                    <input
                      type="text"
                      value={form.riskFactorsOther ?? ''}
                      disabled={pending}
                      onChange={(e) => setField('riskFactorsOther', e.target.value)}
                      className={inputClass(pending)}
                    />
                  </Field>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--amber-bg)] px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]" />
                <div className="text-sm text-ink">
                  {viewRecord?.riskFactors.length ? (
                    <p>{viewRecord.riskFactors.join(' · ')}</p>
                  ) : null}
                  {viewRecord?.riskFactorsOther?.trim() ? (
                    <p className="mt-1 text-quiet">Other: {viewRecord.riskFactorsOther}</p>
                  ) : null}
                </div>
              </div>
            )}
          </Section>
        )}

        {graphArtifacts.length > 0 && (
          <Section title="Assessment graphs" defaultOpen>
            <div className="grid gap-3 md:grid-cols-2">
              {graphArtifacts.map((a) => (
                <GraphInline key={a.id} clientId={clientId} artifact={a} />
              ))}
            </div>
          </Section>
        )}

        {(editable || groupHasContent('client', viewRecord)) && (
          <Section title="Client & diagnosis" defaultOpen={editable || groupHasContent('client', viewRecord)}>
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Patient name">
                  <input type="text" value={form.patientName ?? ''} disabled={pending} onChange={(e) => setField('patientName', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="DOB">
                  <input type="date" value={form.dob ?? ''} disabled={pending} onChange={(e) => setField('dob', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Age">
                  <input type="text" value={form.age ?? ''} disabled={pending} onChange={(e) => setField('age', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Diagnosis">
                  <input type="text" value={form.diagnosis ?? DEFAULT_DIAGNOSIS} disabled={pending} onChange={(e) => setField('diagnosis', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Comorbid diagnosis">
                  <input type="text" value={form.comorbidDiagnosis ?? ''} disabled={pending} onChange={(e) => setField('comorbidDiagnosis', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Report date">
                  <input type="date" value={form.reportDate ?? ''} disabled={pending} onChange={(e) => setField('reportDate', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Assessor">
                  <input type="text" value={form.assessorName ?? ''} disabled={pending} onChange={(e) => setField('assessorName', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Credentials">
                  <input type="text" value={form.assessorCredentials ?? ''} disabled={pending} onChange={(e) => setField('assessorCredentials', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Referring provider">
                  <input type="text" value={form.referringProvider ?? ''} disabled={pending} onChange={(e) => setField('referringProvider', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="NPI">
                  <input type="text" value={form.npi ?? ''} disabled={pending} onChange={(e) => setField('npi', e.target.value)} className={inputClass(pending)} />
                </Field>
              </div>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Patient" value={viewRecord?.patientName ?? null} />
                <DetailRow label="DOB" value={formatDetailDate(viewRecord?.dob ?? null) || null} />
                <DetailRow label="Age" value={viewRecord?.age ?? null} />
                <DetailRow label="Diagnosis" value={viewRecord?.diagnosis ?? null} />
                <DetailRow label="Comorbid" value={viewRecord?.comorbidDiagnosis ?? null} />
                <DetailRow label="Report date" value={formatDetailDate(viewRecord?.reportDate ?? null) || null} />
                <DetailRow label="Assessor" value={viewRecord?.assessorName ?? null} />
                <DetailRow label="Credentials" value={viewRecord?.assessorCredentials ?? null} />
                <DetailRow label="Referring provider" value={viewRecord?.referringProvider ?? null} />
                <DetailRow label="NPI" value={viewRecord?.npi ?? null} />
              </dl>
            )}
          </Section>
        )}

        {(editable || groupHasContent('services', viewRecord)) && (
          <Section title="Services requested" defaultOpen={editable || groupHasContent('services', viewRecord)}>
            {editable ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ['97151 (assessment)', 'hrs97151'],
                      ['97153 direct/wk', 'hrs97153'],
                      ['97155 supervision/wk', 'hrs97155'],
                      ['97156', 'hrs97156'],
                      ['97157', 'hrs97157'],
                    ] as const
                  ).map(([label, key]) => (
                    <Field key={key} label={label}>
                      <input
                        type="text"
                        value={(form[key] as string | null | undefined) ?? ''}
                        disabled={pending}
                        onChange={(e) => setField(key, e.target.value)}
                        className={inputClass(pending)}
                      />
                    </Field>
                  ))}
                  <Field label="Service period">
                    <input type="text" value={form.servicePeriod ?? ''} disabled={pending} onChange={(e) => setField('servicePeriod', e.target.value)} className={inputClass(pending)} />
                  </Field>
                </div>
                <Field label="Locations">
                  <CheckboxGroup
                    options={SERVICE_LOCATION_OPTIONS}
                    value={form.locations ?? []}
                    onChange={(v) => setField('locations', v)}
                    disabled={pending}
                  />
                </Field>
              </>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="97151" value={viewRecord?.hrs97151 ?? null} />
                <DetailRow label="97153 direct/wk" value={viewRecord?.hrs97153 ?? null} />
                <DetailRow label="97155 supervision/wk" value={viewRecord?.hrs97155 ?? null} />
                <DetailRow label="97156" value={viewRecord?.hrs97156 ?? null} />
                <DetailRow label="97157" value={viewRecord?.hrs97157 ?? null} />
                <DetailRow label="Service period" value={viewRecord?.servicePeriod ?? null} />
                <DetailRow label="Locations" value={viewRecord?.locations.length ? viewRecord.locations.join(', ') : null} />
              </dl>
            )}
          </Section>
        )}

        {(editable || groupHasContent('clinical', viewRecord)) && (
          <Section title="Clinical snapshot" defaultOpen={editable || groupHasContent('clinical', viewRecord)}>
            {editable ? (
              <div className="grid gap-3">
                <Field label="Reason for assessment">
                  <textarea value={form.reasonForAssessment ?? ''} disabled={pending} rows={3} onChange={(e) => setField('reasonForAssessment', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Interfering behaviors">
                  <textarea value={form.interferingBehaviors ?? ''} disabled={pending} rows={2} onChange={(e) => setField('interferingBehaviors', e.target.value)} className={inputClass(pending)} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(['targetBehavior1', 'targetBehavior2', 'targetBehavior3'] as const).map((key, i) => (
                    <Field key={key} label={`Target behavior ${i + 1}`}>
                      <input type="text" value={form[key] ?? ''} disabled={pending} onChange={(e) => setField(key, e.target.value)} className={inputClass(pending)} />
                    </Field>
                  ))}
                </div>
                <Field label="Medications">
                  <textarea value={form.medications ?? ''} disabled={pending} rows={2} onChange={(e) => setField('medications', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Allergies">
                  <textarea value={form.allergies ?? ''} disabled={pending} rows={2} onChange={(e) => setField('allergies', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Reassessment date">
                  <input type="date" value={form.reassessmentDate ?? ''} disabled={pending} onChange={(e) => setField('reassessmentDate', e.target.value)} className={inputClass(pending)} />
                </Field>
              </div>
            ) : (
              <dl className="space-y-3">
                <DetailRow label="Reason" value={viewRecord?.reasonForAssessment ?? null} />
                <DetailRow label="Interfering behaviors" value={viewRecord?.interferingBehaviors ?? null} />
                <DetailRow label="Target behavior 1" value={viewRecord?.targetBehavior1 ?? null} />
                <DetailRow label="Target behavior 2" value={viewRecord?.targetBehavior2 ?? null} />
                <DetailRow label="Target behavior 3" value={viewRecord?.targetBehavior3 ?? null} />
                <DetailRow label="Medications" value={viewRecord?.medications ?? null} />
                <DetailRow label="Allergies" value={viewRecord?.allergies ?? null} />
                <DetailRow label="Reassessment date" value={formatDetailDate(viewRecord?.reassessmentDate ?? null) || null} />
              </dl>
            )}
          </Section>
        )}

        {(editable || groupHasContent('instruments', viewRecord)) && (
          <Section title="Instruments" defaultOpen={editable || groupHasContent('instruments', viewRecord)}>
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Vineland date">
                  <input type="date" value={form.vinelandDate ?? ''} disabled={pending} onChange={(e) => setField('vinelandDate', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Vineland comm score">
                  <input type="text" value={form.vinelandCommScore ?? ''} disabled={pending} onChange={(e) => setField('vinelandCommScore', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Vineland social score">
                  <input type="text" value={form.vinelandSocScore ?? ''} disabled={pending} onChange={(e) => setField('vinelandSocScore', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="ATEC date">
                  <input type="date" value={form.atecDate ?? ''} disabled={pending} onChange={(e) => setField('atecDate', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="FAST date">
                  <input type="date" value={form.fastDate ?? ''} disabled={pending} onChange={(e) => setField('fastDate', e.target.value)} className={inputClass(pending)} />
                </Field>
              </div>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Vineland date" value={formatDetailDate(viewRecord?.vinelandDate ?? null) || null} />
                <DetailRow label="Vineland comm" value={viewRecord?.vinelandCommScore ?? null} />
                <DetailRow label="Vineland social" value={viewRecord?.vinelandSocScore ?? null} />
                <DetailRow label="ATEC date" value={formatDetailDate(viewRecord?.atecDate ?? null) || null} />
                <DetailRow label="FAST date" value={formatDetailDate(viewRecord?.fastDate ?? null) || null} />
              </dl>
            )}
          </Section>
        )}

        {(editable || groupHasContent('goals', viewRecord)) && (
          <Section title="Goals overview" defaultOpen={editable || groupHasContent('goals', viewRecord)}>
            {editable ? (
              <CheckboxGroup
                options={GOAL_AREA_OPTIONS}
                value={form.goalAreas ?? []}
                onChange={(v) => setField('goalAreas', v)}
                disabled={pending}
              />
            ) : (
              <DetailRow label="Goal areas" value={viewRecord?.goalAreas.length ? viewRecord.goalAreas.join(', ') : null} />
            )}
          </Section>
        )}

        {(editable || groupHasContent('careTeam', viewRecord)) && (
          <Section title="Care team" defaultOpen={editable || groupHasContent('careTeam', viewRecord)}>
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ['Speech', 'speech'],
                    ['OT', 'ot'],
                    ['PT', 'pt'],
                    ['Teacher', 'teacher'],
                    ['PCP', 'pcp'],
                  ] as const
                ).map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input type="text" value={form[key] ?? ''} disabled={pending} onChange={(e) => setField(key, e.target.value)} className={inputClass(pending)} />
                  </Field>
                ))}
              </div>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Speech" value={viewRecord?.speech ?? null} />
                <DetailRow label="OT" value={viewRecord?.ot ?? null} />
                <DetailRow label="PT" value={viewRecord?.pt ?? null} />
                <DetailRow label="Teacher" value={viewRecord?.teacher ?? null} />
                <DetailRow label="PCP" value={viewRecord?.pcp ?? null} />
              </dl>
            )}
          </Section>
        )}

        {(editable || groupHasContent('signOff', viewRecord)) && (
          <Section title="Sign-off" defaultOpen={editable || groupHasContent('signOff', viewRecord)}>
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="BCBA name">
                  <input type="text" value={form.bcbaName ?? ''} disabled={pending} onChange={(e) => setField('bcbaName', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="BCBA date">
                  <input type="date" value={form.bcbaDate ?? ''} disabled={pending} onChange={(e) => setField('bcbaDate', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Parent name">
                  <input type="text" value={form.parentName ?? ''} disabled={pending} onChange={(e) => setField('parentName', e.target.value)} className={inputClass(pending)} />
                </Field>
                <Field label="Parent date">
                  <input type="date" value={form.parentDate ?? ''} disabled={pending} onChange={(e) => setField('parentDate', e.target.value)} className={inputClass(pending)} />
                </Field>
              </div>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="BCBA" value={viewRecord?.bcbaName ?? null} />
                <DetailRow label="BCBA date" value={formatDetailDate(viewRecord?.bcbaDate ?? null) || null} />
                <DetailRow label="Parent" value={viewRecord?.parentName ?? null} />
                <DetailRow label="Parent date" value={formatDetailDate(viewRecord?.parentDate ?? null) || null} />
              </dl>
            )}
          </Section>
        )}
      </div>
    </section>
  )
}
