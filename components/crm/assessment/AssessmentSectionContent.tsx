'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/crm/assessment/SectionCard'
import {
  DisplayBoilerplate,
  PrefilledTextArea,
} from '@/components/crm/assessment/PrefilledTextArea'
import { CheckboxGroup } from '@/components/crm/assessment/CheckboxGroup'
import { ContactFieldEditor } from '@/components/crm/assessment/ContactFieldEditor'
import { GoalTable } from '@/components/crm/assessment/GoalTable'
import { AttachmentUploader } from '@/components/crm/assessment/AttachmentUploader'
import { BehaviorBlockEditor } from '@/components/crm/assessment/BehaviorBlockEditor'
import SignaturePad from '@/components/rbt/SignaturePad'
import {
  ASSESSOR_CREDENTIALS_SUFFIX,
  CRISIS_ESCALATION_INSTRUCTIONS,
  CRISIS_RISK_FACTOR_OPTIONS,
  GROUP_PARENT_TRAINING_GRAPHS_NOTE,
  LOCATION_OF_SERVICES_BACB_QUOTE,
  LOCATION_OF_SERVICES_INTRO,
  NEXT_LEVEL_OF_CARE_OPTIONS,
  PRIMARY_LOCATION_OPTIONS,
  TREATMENT_REQUESTS_INTRO,
} from '@/lib/crm/assessment/boilerplate'
import {
  emptyBehaviorBlock,
  emptyScheduleRow,
  emptyTransitionCriteriaRow,
  type AssessmentSectionData,
  type AssessmentSectionKey,
} from '@/lib/crm/assessment/assessment.schema'
import { computeAgeFromDob, calendarDateFromInput } from '@/lib/crm/assessment/prefill'

export const SECTION_NAV: { key: AssessmentSectionKey; label: string }[] = [
  { key: 'summary', label: 'Initial Assessment Summary' },
  { key: 'treatmentRequest', label: 'Treatment Requests' },
  { key: 'locationSchedule', label: 'Location & Schedule' },
  { key: 'bioPsychosocial', label: 'Bio-Psychosocial' },
  { key: 'instruments', label: 'Instruments & Methods' },
  { key: 'presentLevels', label: 'Present Levels' },
  { key: 'environmental', label: 'Environmental Barriers' },
  { key: 'responseToTx', label: 'Response to Treatment' },
  { key: 'interventions', label: '97155 Interventions' },
  { key: 'behaviors', label: 'FBA / BIP' },
  { key: 'goals', label: 'Treatment Goals' },
  { key: 'parentTraining', label: 'Parent Training' },
  { key: 'servicesProtocols', label: 'Services Protocols' },
  { key: 'transitionPlan', label: 'Transition Plan' },
  { key: 'coordination', label: 'Team Coordination' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'crisisPlan', label: 'Crisis Plan' },
  { key: 'signatures', label: 'Signatures' },
]

type AttachmentRecord = {
  id: string
  sectionKey: string
  fileName: string
  mimeType: string
}

type Props = {
  activeSection: AssessmentSectionKey
  sections: AssessmentSectionData
  setSections: React.Dispatch<React.SetStateAction<AssessmentSectionData>>
  readOnly?: boolean
  onBlur?: () => void
  onSaveSection?: (key: AssessmentSectionKey) => void
  savingSection?: AssessmentSectionKey | null
  clientId: string
  assessmentId: string
  attachments: AttachmentRecord[]
  onUploaded: () => void
}

export function AssessmentSectionContent(props: Props) {
  const { activeSection } = props
  switch (activeSection) {
    case 'summary':
      return <SummarySection {...props} />
    case 'treatmentRequest':
      return <TreatmentRequestSection {...props} />
    case 'locationSchedule':
      return <LocationScheduleSection {...props} />
    case 'bioPsychosocial':
      return <BioPsychosocialSection {...props} />
    case 'instruments':
      return <InstrumentsSection {...props} />
    case 'presentLevels':
      return <PresentLevelsSection {...props} />
    case 'environmental':
      return <EnvironmentalSection {...props} />
    case 'responseToTx':
      return <ResponseToTxSection {...props} />
    case 'interventions':
      return <InterventionsSection {...props} />
    case 'behaviors':
      return <BehaviorsSection {...props} />
    case 'goals':
      return <GoalsSection {...props} />
    case 'parentTraining':
      return <ParentTrainingSection {...props} />
    case 'servicesProtocols':
      return <ServicesProtocolsSection {...props} />
    case 'transitionPlan':
      return <TransitionPlanSection {...props} />
    case 'coordination':
      return <CoordinationSection {...props} />
    case 'recommendations':
      return <RecommendationsSection {...props} />
    case 'crisisPlan':
      return <CrisisPlanSection {...props} />
    case 'signatures':
      return <SignaturesSection {...props} />
    default:
      return null
  }
}

function wrap(
  props: Props,
  key: AssessmentSectionKey,
  title: string,
  children: React.ReactNode
) {
  return (
    <SectionCard
      id={key}
      title={title}
      onSave={props.onSaveSection ? () => props.onSaveSection!(key) : undefined}
      saving={props.savingSection === key}
      readOnly={props.readOnly}
    >
      {children}
    </SectionCard>
  )
}

function SummarySection(props: Props) {
  const s = props.sections.summary
  const set = (patch: Partial<typeof s>) =>
    props.setSections((prev) => ({ ...prev, summary: { ...prev.summary, ...patch } }))

  const onDobChange = (dateOfBirth: string) => {
    const dob = calendarDateFromInput(dateOfBirth)
    set({ dateOfBirth, age: computeAgeFromDob(dob) })
  }

  return wrap(props, 'summary', 'Initial Assessment Summary', (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Patient Name">
        <Input value={s.patientName} onChange={(e) => set({ patientName: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Parent Name">
        <Input value={s.parentName} onChange={(e) => set({ parentName: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Diagnosis">
        <Input value={s.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Comorbid Diagnosis">
        <Input value={s.comorbidDiagnosis} onChange={(e) => set({ comorbidDiagnosis: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Date of Birth">
        <Input type="date" value={s.dateOfBirth} onChange={(e) => onDobChange(e.target.value)} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Age">
        <Input value={s.age} readOnly className="bg-canvas/50" />
      </Field>
      <Field label="Referring Provider">
        <Input value={s.referringProvider} onChange={(e) => set({ referringProvider: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="NPI">
        <Input value={s.npi} onChange={(e) => set({ npi: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Report Date">
        <Input type="date" value={s.reportDate} onChange={(e) => set({ reportDate: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label={`Assessor Name${ASSESSOR_CREDENTIALS_SUFFIX}`}>
        <Input value={s.assessorName} onChange={(e) => set({ assessorName: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Assessor Email">
        <Input type="email" value={s.assessorEmail} onChange={(e) => set({ assessorEmail: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
      <Field label="Assessor Phone">
        <Input value={s.assessorPhone} onChange={(e) => set({ assessorPhone: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
    </div>
  ))
}

function TreatmentRequestSection(props: Props) {
  const t = props.sections.treatmentRequest
  const set = (patch: Partial<typeof t>) =>
    props.setSections((prev) => ({ ...prev, treatmentRequest: { ...prev.treatmentRequest, ...patch } }))

  return wrap(props, 'treatmentRequest', 'Treatment Requests & Intensity', (
    <div className="space-y-4">
      <DisplayBoilerplate text={TREATMENT_REQUESTS_INTRO} />
      <table className="w-full border border-line text-sm">
        <thead><tr className="bg-canvas/60"><th className="p-2 text-left">Code</th><th className="p-2 text-left">Service</th><th className="p-2 text-left">Requested Hours</th></tr></thead>
        <tbody>
          <IntensityRow code="97151" label="Initial assessment — hours per authorization period" value={t.hrs97151} onChange={(v) => set({ hrs97151: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
          <IntensityRow code="97153" label="Direct 1:1 ABA Treatment — hours weekly initially; 25 hours weekly thereafter" value={t.hrs97153Initial} onChange={(v) => set({ hrs97153Initial: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
          <IntensityRow code="97155" label="Direction of Technician / Protocol Modification (BCBA present) — hours weekly initially; 2.5 hours weekly thereafter" value={t.hrs97155Initial} onChange={(v) => set({ hrs97155Initial: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
          <IntensityRow code="97156" label="Parent / Caregiver Training — hour weekly (no less than 2x sessions monthly)" value={t.hrs97156} onChange={(v) => set({ hrs97156: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
          <IntensityRow code="97157" label="Group Parent Training — hours monthly (if applicable)" value={t.hrs97157} onChange={(v) => set({ hrs97157: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
        </tbody>
      </table>
      <Field label="Service Period">
        <Input value={t.servicePeriod} onChange={(e) => set({ servicePeriod: e.target.value })} onBlur={props.onBlur} readOnly={props.readOnly} />
      </Field>
    </div>
  ))
}

function LocationScheduleSection(props: Props) {
  const ls = props.sections.locationSchedule
  const setLoc = (key: string, checked: boolean) =>
    props.setSections((prev) => ({
      ...prev,
      locationSchedule: {
        ...prev.locationSchedule,
        primaryLocations: { ...prev.locationSchedule.primaryLocations, [key]: checked },
      },
    }))
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return wrap(props, 'locationSchedule', 'Location of Services & Schedule', (
    <div className="space-y-4">
      <DisplayBoilerplate text={LOCATION_OF_SERVICES_INTRO} />
      <DisplayBoilerplate text={LOCATION_OF_SERVICES_BACB_QUOTE} />
      <CheckboxGroup
        options={PRIMARY_LOCATION_OPTIONS.map((k) => ({
          key: k,
          label: k.charAt(0).toUpperCase() + k.slice(1),
        }))}
        values={ls.primaryLocations as Record<string, boolean>}
        onChange={setLoc}
        readOnly={props.readOnly}
      />
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full border border-line text-xs">
          <thead>
            <tr className="bg-canvas/60">
              <th className="p-2 text-left">Service</th>
              {dayLabels.map((d) => <th key={d} className="p-2">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {ls.scheduleRows.map((row, ri) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-1">
                  <Input value={row.label} onChange={(e) => {
                    props.setSections((prev) => ({
                      ...prev,
                      locationSchedule: {
                        ...prev.locationSchedule,
                        scheduleRows: prev.locationSchedule.scheduleRows.map((r, i) =>
                          i === ri ? { ...r, label: e.target.value } : r
                        ),
                      },
                    }))
                  }} readOnly={props.readOnly} className="text-xs" />
                </td>
                {weekdays.map((d) => (
                  <td key={d} className="p-1">
                    <Input
                      value={row.schedule[d] ?? ''}
                      onChange={(e) => {
                        props.setSections((prev) => ({
                          ...prev,
                          locationSchedule: {
                            ...prev.locationSchedule,
                            scheduleRows: prev.locationSchedule.scheduleRows.map((r, i) =>
                              i === ri ? { ...r, schedule: { ...r.schedule, [d]: e.target.value } } : r
                            ),
                          },
                        }))
                      }}
                      onBlur={props.onBlur}
                      readOnly={props.readOnly}
                      className="text-xs"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!props.readOnly && (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() =>
            props.setSections((prev) => ({
              ...prev,
              locationSchedule: {
                ...prev.locationSchedule,
                scheduleRows: [...prev.locationSchedule.scheduleRows, emptyScheduleRow('', 'Additional service line')],
              },
            }))
          }>Add row</Button>
        )}
      </div>
    </div>
  ))
}

function BioPsychosocialSection(props: Props) {
  const b = props.sections.bioPsychosocial
  const fields: { key: keyof typeof b; label: string }[] = [
    { key: 'generalInformation', label: 'General Information' },
    { key: 'familyStructure', label: 'Family structure' },
    { key: 'developmentalHistory', label: 'Developmental history' },
    { key: 'medicalHistory', label: 'Medical History' },
    { key: 'reasonForAssessment', label: 'Reason for Assessment' },
    { key: 'medications', label: 'Medications' },
    { key: 'allergies', label: 'Allergies' },
    { key: 'familyHistoryOfAutism', label: 'Family history of autism' },
    { key: 'educationalSetting', label: 'Educational Setting' },
    { key: 'parentInvolvement', label: 'Parent Level of Involvement & Family Support System' },
  ]
  return wrap(props, 'bioPsychosocial', 'Bio-Psychosocial Information', (
    <div className="space-y-3">
      {fields.map(({ key, label }) => (
        <PrefilledTextArea key={key} label={label} value={b[key]} readOnly={props.readOnly} onBlur={props.onBlur}
          onChange={(v) => props.setSections((prev) => ({ ...prev, bioPsychosocial: { ...prev.bioPsychosocial, [key]: v } }))} />
      ))}
    </div>
  ))
}

function InstrumentsSection(props: Props) {
  const i = props.sections.instruments
  const set = (key: keyof typeof i, v: string) =>
    props.setSections((prev) => ({ ...prev, instruments: { ...prev.instruments, [key]: v } }))
  return wrap(props, 'instruments', 'Summary of Assessment Instruments & Methods', (
    <div className="space-y-3">
      <h4 className="font-medium">Indirect Methods</h4>
      <PrefilledTextArea label="Family/caregiver(s) interview" value={i.familyCaregiverInterview} onChange={(v) => set('familyCaregiverInterview', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <PrefilledTextArea label="Records reviewed (IEP, psych evals, reports from other ABA providers, etc.)" value={i.recordsReviewed} onChange={(v) => set('recordsReviewed', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <h4 className="font-medium">Direct Methods / Skills Assessment(s)</h4>
      <Field label="Vineland Assessment Tool completed by parent on (updated every 6 months)">
        <Input type="date" value={i.vinelandCompletedDate} onChange={(e) => set('vinelandCompletedDate', e.target.value)} readOnly={props.readOnly} onBlur={props.onBlur} />
      </Field>
      <PrefilledTextArea label="Behavior Assessment (FAST) (updated every 6 months)" value={i.fastAssessment} onChange={(v) => set('fastAssessment', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <PrefilledTextArea label="Autism Treatment Evaluation Checklist (ATEC)" value={i.atecAssessment} onChange={(v) => set('atecAssessment', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <PrefilledTextArea label="Observation 1" value={i.observation1} onChange={(v) => set('observation1', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <PrefilledTextArea label="Observation 2" value={i.observation2} onChange={(v) => set('observation2', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <PrefilledTextArea label="Preference Assessment" value={i.preferenceAssessment} onChange={(v) => set('preferenceAssessment', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
    </div>
  ))
}

function PresentLevelsSection(props: Props) {
  const p = props.sections.presentLevels
  const instruments = [
    { key: 'vineland' as const, label: 'Vineland', sectionKey: 'present_levels.vineland' },
    { key: 'atec' as const, label: 'ATEC', sectionKey: 'present_levels.atec' },
    { key: 'fast' as const, label: 'FAST', sectionKey: 'present_levels.fast' },
  ]
  return wrap(props, 'presentLevels', 'Present Levels of Performance by Domain', (
    <div className="space-y-6">
      {instruments.map(({ key, label, sectionKey }) => (
        <div key={key} className="space-y-2 rounded-lg border border-line p-3">
          <h4 className="font-medium">{label}</h4>
          <AttachmentUploader clientId={props.clientId} assessmentId={props.assessmentId} sectionKey={sectionKey} kind="IMAGE" accept="image/*" multiple attachments={props.attachments} readOnly={props.readOnly} onUploaded={props.onUploaded} label="Add screenshots / graphs" />
          {key === 'vineland' && (
            <Field label="Date"><Input type="date" value={p.vineland.date} onChange={(e) => props.setSections((prev) => ({ ...prev, presentLevels: { ...prev.presentLevels, vineland: { ...prev.presentLevels.vineland, date: e.target.value } } }))} readOnly={props.readOnly} onBlur={props.onBlur} /></Field>
          )}
          <PrefilledTextArea label="Interpretation" value={p[key].interpretation} onChange={(v) => props.setSections((prev) => ({ ...prev, presentLevels: { ...prev.presentLevels, [key]: { ...prev.presentLevels[key], interpretation: v } } }))} readOnly={props.readOnly} onBlur={props.onBlur} />
        </div>
      ))}
      <div className="space-y-2">
        <h4 className="font-medium">Additional screenshots / attachments</h4>
        <AttachmentUploader clientId={props.clientId} assessmentId={props.assessmentId} sectionKey="present_levels.extra" kind="IMAGE" accept="image/*" multiple attachments={props.attachments} readOnly={props.readOnly} onUploaded={props.onUploaded} />
      </div>
    </div>
  ))
}

function EnvironmentalSection(props: Props) {
  return wrap(props, 'environmental', 'Environmental Factors That Interfere with Progress/Barriers', (
    <PrefilledTextArea value={props.sections.environmental.barriers} onChange={(v) => props.setSections((prev) => ({ ...prev, environmental: { barriers: v } }))} readOnly={props.readOnly} onBlur={props.onBlur} rows={8} />
  ))
}

function ResponseToTxSection(props: Props) {
  return wrap(props, 'responseToTx', 'Response to Treatment', (
    <PrefilledTextArea value={props.sections.responseToTx.narrative} onChange={(v) => props.setSections((prev) => ({ ...prev, responseToTx: { narrative: v } }))} readOnly={props.readOnly} onBlur={props.onBlur} rows={4} />
  ))
}

function InterventionsSection(props: Props) {
  return wrap(props, 'interventions', '97155 Interventions & Barriers to Treatment', (
    <PrefilledTextArea value={props.sections.interventions.narrative} onChange={(v) => props.setSections((prev) => ({ ...prev, interventions: { narrative: v } }))} readOnly={props.readOnly} onBlur={props.onBlur} rows={10} />
  ))
}

function BehaviorsSection(props: Props) {
  const blocks = props.sections.behaviors.blocks
  return wrap(props, 'behaviors', 'Functional Behavior Assessment & Behavior Intervention Plan', (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <BehaviorBlockEditor key={block.id} index={index} block={block}
          onChange={(b) => props.setSections((prev) => ({ ...prev, behaviors: { blocks: prev.behaviors.blocks.map((x, i) => i === index ? b : x) } }))}
          onRemove={blocks.length > 1 ? () => props.setSections((prev) => ({ ...prev, behaviors: { blocks: prev.behaviors.blocks.filter((_, i) => i !== index) } })) : undefined}
          readOnly={props.readOnly} onBlur={props.onBlur} clientId={props.clientId} assessmentId={props.assessmentId} attachments={props.attachments} onUploaded={props.onUploaded} />
      ))}
      {!props.readOnly && (
        <Button type="button" variant="outline" onClick={() => props.setSections((prev) => ({ ...prev, behaviors: { blocks: [...prev.behaviors.blocks, emptyBehaviorBlock()] } }))}>Add Behavior</Button>
      )}
    </div>
  ))
}

function GoalsSection(props: Props) {
  const g = props.sections.goals
  const setGoals = (patch: Partial<typeof g>) => props.setSections((prev) => ({ ...prev, goals: { ...prev.goals, ...patch } }))
  return wrap(props, 'goals', 'Treatment Goals', (
    <div className="space-y-8">
      <div>
        <PrefilledTextArea label="Analysis of Behavior Progress" value={g.behaviorReduction.analysisNarrative} onChange={(v) => setGoals({ behaviorReduction: { ...g.behaviorReduction, analysisNarrative: v } })} readOnly={props.readOnly} onBlur={props.onBlur} />
        <p className="mb-2 mt-4 text-sm font-medium">Behavior Reduction Goals</p>
        <GoalTable variant="A" rows={g.behaviorReduction.rows} onChange={(rows) => setGoals({ behaviorReduction: { ...g.behaviorReduction, rows } })} readOnly={props.readOnly} onBlur={props.onBlur} />
      </div>
      {([
        ['communication', 'Communication Goals', 'Current level of communication skills'],
        ['social', 'Social Interaction & Social Communication Goals', 'Current level of social skills'],
        ['adaptive', 'Adaptive Skills', 'Current level of adaptive skills'],
        ['livingSelfHelp', 'Living skills / self-help skills', 'Current level of Living skills/self-help skills'],
      ] as const).map(([key, title, levelLabel]) => (
        <div key={key}>
          <p className="mb-2 text-sm font-medium">{title}</p>
          <PrefilledTextArea label={levelLabel} value={g[key].currentLevel} onChange={(v) => setGoals({ [key]: { ...g[key], currentLevel: v } })} readOnly={props.readOnly} onBlur={props.onBlur} rows={2} />
          <GoalTable variant="A" rows={g[key].rows} onChange={(rows) => setGoals({ [key]: { ...g[key], rows } })} readOnly={props.readOnly} onBlur={props.onBlur} />
        </div>
      ))}
    </div>
  ))
}

function ParentTrainingSection(props: Props) {
  const pt = props.sections.parentTraining
  const set = (patch: Partial<typeof pt>) => props.setSections((prev) => ({ ...prev, parentTraining: { ...prev.parentTraining, ...patch } }))
  return wrap(props, 'parentTraining', 'Parent Training Summary & Goals', (
    <div className="space-y-6">
      <PrefilledTextArea label="Parent Training Summary & Goals" value={pt.summaryNarrative} onChange={(v) => set({ summaryNarrative: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
      <GoalTable variant="B" rows={pt.summaryGoals} onChange={(rows) => set({ summaryGoals: rows })} readOnly={props.readOnly} onBlur={props.onBlur} />
      <PrefilledTextArea label="Group Parent Training Goals — Clinical Rationale" value={pt.groupClinicalRationale} onChange={(v) => set({ groupClinicalRationale: v })} readOnly={props.readOnly} onBlur={props.onBlur} />
      <GoalTable variant="B" rows={pt.groupGoals} onChange={(rows) => set({ groupGoals: rows })} readOnly={props.readOnly} onBlur={props.onBlur} />
      <DisplayBoilerplate text={GROUP_PARENT_TRAINING_GRAPHS_NOTE} />
    </div>
  ))
}

function ServicesProtocolsSection(props: Props) {
  const sp = props.sections.servicesProtocols
  const set = (key: keyof typeof sp, v: string) => props.setSections((prev) => ({ ...prev, servicesProtocols: { ...prev.servicesProtocols, [key]: v } }))
  const blocks: { key: keyof typeof sp; label: string }[] = [
    { key: 'directionOfTechnician', label: 'Direction of Technician or Adaptive Behavior Treatment with Protocol Modification' },
    { key: 'coordinationOfCare', label: 'Coordination of Care' },
    { key: 'parentTraining', label: 'Parent Training' },
    { key: 'groupParentTraining', label: 'Group Parent Training' },
    { key: 'reAssessment', label: 'Re-Assessment' },
    { key: 'generalizationTransition', label: 'Generalization, Transition Criteria & Services Plan' },
  ]
  return wrap(props, 'servicesProtocols', 'Services Protocols & Details', (
    <div className="space-y-4">
      {blocks.map(({ key, label }) => (
        <PrefilledTextArea key={key} label={label} value={sp[key] as string} onChange={(v) => set(key, v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      ))}
      <PrefilledTextArea label="Please list the names, organizations, contact information for each professional with which you coordinate care" value={sp.coordinationContacts} onChange={(v) => set('coordinationContacts', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
    </div>
  ))
}

function TransitionPlanSection(props: Props) {
  const tp = props.sections.transitionPlan
  const set = (patch: Partial<typeof tp>) => props.setSections((prev) => ({ ...prev, transitionPlan: { ...prev.transitionPlan, ...patch } }))
  const nextLabels: Record<string, string> = {
    reducedIntensityAba: 'Reduced intensity ABA services',
    hybridHomeCommunity: 'Hybrid home/community-based services',
    parentMediatedIntervention: 'Parent-mediated intervention',
    schoolConsultation: 'School consultation',
    socialSkillsProgramming: 'Social skills programming as appropriate',
  }
  return wrap(props, 'transitionPlan', 'Transition Plan / Maintenance / Discharge', (
    <div className="space-y-4">
      <PrefilledTextArea label="Generalization strategies & Maintenance" value={tp.maintenanceGeneralization} onChange={(v) => set({ maintenanceGeneralization: v })} readOnly={props.readOnly} onBlur={props.onBlur} rows={8} />
      <PrefilledTextArea label="Transition Plan" value={tp.transitionPlanNarrative} onChange={(v) => set({ transitionPlanNarrative: v })} readOnly={props.readOnly} onBlur={props.onBlur} rows={8} />
      <PrefilledTextArea label="Communication hour-reduction criteria" value={tp.communicationCriteria} onChange={(v) => set({ communicationCriteria: v })} readOnly={props.readOnly} onBlur={props.onBlur} rows={8} />
      <PrefilledTextArea label="Social hour-reduction criteria" value={tp.socialCriteria} onChange={(v) => set({ socialCriteria: v })} readOnly={props.readOnly} onBlur={props.onBlur} rows={8} />
      <TransitionCriteriaTable rows={tp.criteriaRows} readOnly={props.readOnly} onBlur={props.onBlur}
        onChange={(rows) => set({ criteriaRows: rows })}
        onAdd={() => set({ criteriaRows: [...tp.criteriaRows, emptyTransitionCriteriaRow()] })} />
      <CheckboxGroup options={NEXT_LEVEL_OF_CARE_OPTIONS.map((k) => ({ key: k, label: nextLabels[k] }))}
        values={tp.nextLevelOfCare as Record<string, boolean>}
        onChange={(key, checked) => set({ nextLevelOfCare: { ...tp.nextLevelOfCare, [key]: checked } })}
        readOnly={props.readOnly} />
      <PrefilledTextArea label="DISCHARGE" value={tp.dischargeNarrative} onChange={(v) => set({ dischargeNarrative: v })} readOnly={props.readOnly} onBlur={props.onBlur} rows={6} />
    </div>
  ))
}

function CoordinationSection(props: Props) {
  const c = props.sections.coordination
  const setContact = (role: keyof Pick<typeof c, 'speechTherapist' | 'occupationalTherapist' | 'classTeacher' | 'physicalTherapist' | 'primaryCareProvider'>, v: typeof c.speechTherapist) =>
    props.setSections((prev) => ({ ...prev, coordination: { ...prev.coordination, [role]: v } }))
  return wrap(props, 'coordination', 'Coordination with Team', (
    <div className="space-y-4">
      <ContactFieldEditor label="Speech Therapist" value={c.speechTherapist} onChange={(v) => setContact('speechTherapist', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <ContactFieldEditor label="Occupational Therapist" value={c.occupationalTherapist} onChange={(v) => setContact('occupationalTherapist', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <ContactFieldEditor label="Class teacher" value={c.classTeacher} onChange={(v) => setContact('classTeacher', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <ContactFieldEditor label="Physical Therapist" value={c.physicalTherapist} onChange={(v) => setContact('physicalTherapist', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      <ContactFieldEditor label="Primary care provider" value={c.primaryCareProvider} onChange={(v) => setContact('primaryCareProvider', v)} readOnly={props.readOnly} onBlur={props.onBlur} />
      {c.additionalMembers.map((m, i) => (
        <div key={m.id} className="space-y-2">
          <Input value={m.role} placeholder="Role" onChange={(e) => props.setSections((prev) => ({ ...prev, coordination: { ...prev.coordination, additionalMembers: prev.coordination.additionalMembers.map((x, j) => j === i ? { ...x, role: e.target.value } : x) } }))} readOnly={props.readOnly} />
          <ContactFieldEditor label="Contact" value={m.contact} onChange={(v) => props.setSections((prev) => ({ ...prev, coordination: { ...prev.coordination, additionalMembers: prev.coordination.additionalMembers.map((x, j) => j === i ? { ...x, contact: v } : x) } }))} readOnly={props.readOnly} onBlur={props.onBlur} />
        </div>
      ))}
      {!props.readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={() => props.setSections((prev) => ({ ...prev, coordination: { ...prev.coordination, additionalMembers: [...prev.coordination.additionalMembers, { id: crypto.randomUUID(), role: '', contact: { name: '', organization: '', phone: '', email: '' } }] } }))}>Add team member</Button>
      )}
      <PrefilledTextArea label="Treatment Plan Review and Change" value={c.treatmentPlanReview} onChange={(v) => props.setSections((prev) => ({ ...prev, coordination: { ...prev.coordination, treatmentPlanReview: v } }))} readOnly={props.readOnly} onBlur={props.onBlur} rows={6} />
    </div>
  ))
}

function RecommendationsSection(props: Props) {
  return wrap(props, 'recommendations', 'Recommendations for Treatment', (
    <PrefilledTextArea value={props.sections.recommendations.narrative} onChange={(v) => props.setSections((prev) => ({ ...prev, recommendations: { narrative: v } }))} readOnly={props.readOnly} onBlur={props.onBlur} rows={12} />
  ))
}

function CrisisPlanSection(props: Props) {
  const cp = props.sections.crisisPlan.riskFactors
  const crisisLabels: Record<string, string> = {
    assaultiveBehavior: 'Assaultive Behavior',
    selfInjuriousBehavior: 'Self-Injurious Behavior (SIB)',
    fireSetting: 'Fire Setting',
    impulsiveBehavior: 'Impulsive Behavior',
    selfMutilation: 'Self-Mutilation/Cutting',
    currentFamilyViolence: 'Current Family Violence',
    priorPsychiatricInpatient: 'Prior Psychiatric Inpatient Administration',
    elopement: 'Elopement',
    sexuallyOffendingBehavior: 'Sexually Offending Behavior',
    currentSubstanceAbuse: 'Current Substance Abuse',
    psychoticSymptoms: 'Psychotic Symptoms',
    caringForIllFamilyMember: 'Caring for ill family member',
    copingWithSignificantLoss: 'Coping with significant loss (job, relationship, financial)',
    other: 'Other',
  }
  return wrap(props, 'crisisPlan', 'Emergency Response / Crisis Plan', (
    <div className="space-y-4">
      <p className="text-sm font-medium">Please check risk factors as applicable.</p>
      <CheckboxGroup
        options={CRISIS_RISK_FACTOR_OPTIONS.map((k) => ({ key: k, label: crisisLabels[k] }))}
        values={Object.fromEntries(
          Object.entries(cp).filter(([k]) => k !== 'otherText')
        ) as Record<string, boolean>}
        onChange={(key, checked) => props.setSections((prev) => ({ ...prev, crisisPlan: { riskFactors: { ...prev.crisisPlan.riskFactors, [key]: checked } } }))}
        readOnly={props.readOnly}
        otherKey="other"
        otherText={cp.otherText}
        onOtherTextChange={(v) => props.setSections((prev) => ({ ...prev, crisisPlan: { riskFactors: { ...prev.crisisPlan.riskFactors, otherText: v } } }))}
      />
      <DisplayBoilerplate text={CRISIS_ESCALATION_INSTRUCTIONS} />
    </div>
  ))
}

function SignaturesSection(props: Props) {
  const sig = props.sections.signatures
  const setSig = (role: keyof typeof sig, patch: Partial<(typeof sig)['bcba']>) =>
    props.setSections((prev) => ({ ...prev, signatures: { ...prev.signatures, [role]: { ...prev.signatures[role], ...patch } } }))

  const roles: { key: keyof typeof sig; title: string; credDefault?: string }[] = [
    { key: 'bcba', title: 'BCBA Name and Credentials', credDefault: 'BCBA/LBA' },
    { key: 'graduatePermit', title: 'Graduate Permit Name and Credentials' },
    { key: 'parentGuardian', title: 'Parent or Guardian Name' },
  ]

  return wrap(props, 'signatures', 'Signatures', (
    <div className="space-y-8">
      {roles.map(({ key, title, credDefault }) => (
        <div key={key} className="space-y-3 rounded-lg border border-line p-4">
          <h4 className="font-medium">{title}</h4>
          <Field label="Name">
            <Input value={sig[key].name} onChange={(e) => setSig(key, { name: e.target.value })} readOnly={props.readOnly} onBlur={props.onBlur} />
          </Field>
          <Field label="Credentials">
            <Input value={sig[key].credentials || credDefault || ''} onChange={(e) => setSig(key, { credentials: e.target.value })} readOnly={props.readOnly} onBlur={props.onBlur} />
          </Field>
          {!props.readOnly ? (
            <>
              <SignaturePad onSignatureComplete={(dataUrl) => setSig(key, { signatureData: dataUrl })} />
              <Field label="Or type name">
                <Input value={sig[key].signatureTypedName ?? ''} onChange={(e) => setSig(key, { signatureTypedName: e.target.value })} onBlur={props.onBlur} />
              </Field>
            </>
          ) : sig[key].signatureData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sig[key].signatureData} alt="Signature" className="max-h-24 border border-line" />
          ) : sig[key].signatureTypedName ? (
            <p className="font-serif text-lg italic">{sig[key].signatureTypedName}</p>
          ) : null}
          <Field label="Date">
            <Input type="date" value={sig[key].date} onChange={(e) => setSig(key, { date: e.target.value })} readOnly={props.readOnly} onBlur={props.onBlur} />
          </Field>
        </div>
      ))}
    </div>
  ))
}

function IntensityRow({ code, label, value, onChange, readOnly, onBlur }: { code: string; label: string; value: string; onChange: (v: string) => void; readOnly?: boolean; onBlur?: () => void }) {
  return (
    <tr className="border-t border-line">
      <td className="p-2 align-top font-mono text-xs">{code}</td>
      <td className="p-2 align-top text-xs">{label}</td>
      <td className="p-2 align-top"><Input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} readOnly={readOnly} className="max-w-[120px]" /></td>
    </tr>
  )
}

function TransitionCriteriaTable({ rows, onChange, onAdd, readOnly, onBlur }: {
  rows: AssessmentSectionData['transitionPlan']['criteriaRows']
  onChange: (rows: AssessmentSectionData['transitionPlan']['criteriaRows']) => void
  onAdd: () => void
  readOnly?: boolean
  onBlur?: () => void
}) {
  const cols = ['criteria', 'directHoursChangeTo', 'parentTrainingIncrease', 'supervisionDecrease', 'dateExpected'] as const
  const labels = ['Criteria', 'Direct Hours Change to', 'Parent Training Increase', 'Supervision Decrease', 'Date Expected']
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full border border-line text-xs">
        <thead><tr className="bg-canvas/60">{labels.map((l) => <th key={l} className="p-2 text-left">{l}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id} className="border-t border-line">
              {cols.map((col) => (
                <td key={col} className="p-1 align-top">
                  <Textarea value={row[col]} onChange={(e) => onChange(rows.map((r, i) => i === ri ? { ...r, [col]: e.target.value } : r))} onBlur={onBlur} readOnly={readOnly} rows={2} className="text-xs min-w-[140px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onAdd}>Add criteria row</Button>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label>{label}</Label>{children}</div>)
}
