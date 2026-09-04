import { formatCalendarDate } from '@/lib/billing/calendarDate'
import {
  ASSESSOR_CREDENTIALS_SUFFIX,
  CRISIS_ESCALATION_INSTRUCTIONS,
  CRISIS_RISK_FACTOR_OPTIONS,
  GROUP_PARENT_TRAINING_GRAPHS_NOTE,
  INTERVENTIONS_97155_DEFAULT,
  LOCATION_OF_SERVICES_BACB_QUOTE,
  LOCATION_OF_SERVICES_INTRO,
  TREATMENT_REQUESTS_INTRO,
} from '@/lib/crm/assessment/boilerplate'
import type { AssessmentSectionData } from '@/lib/crm/assessment/assessment.schema'
import type { TreatmentAssessmentStatus, TreatmentAssessmentSource } from '@prisma/client'
import { AssessmentPrintToolbar } from '@/components/crm/assessment/AssessmentPrintToolbar'

type Props = {
  clientId: string
  assessmentId: string
  client: {
    clientCode: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
  }
  sections: AssessmentSectionData
  attachments: {
    id: string
    sectionKey: string
    fileName: string
    mimeType: string
  }[]
  attachmentUrls: Record<string, string>
  status: TreatmentAssessmentStatus
  source: TreatmentAssessmentSource
}

const CRISIS_LABELS: Record<string, string> = {
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

const SIGNATURE_BLOCKS = [
  {
    key: 'bcba' as const,
    title: 'BCBA Signature',
    purpose:
      'The supervising BCBA certifies this Initial Assessment and Treatment Plan is accurate and approves recommended services.',
  },
  {
    key: 'graduatePermit' as const,
    title: 'Graduate Permit Signature',
    purpose:
      'Graduate permit holder attests to participation in assessment activities under BCBA supervision.',
  },
  {
    key: 'parentGuardian' as const,
    title: 'Parent or Guardian Signature',
    purpose:
      'Parent/guardian acknowledges receipt and review of the treatment plan and consents to proposed services.',
  },
]

export function AssessmentPrintView(props: Props) {
  const clientName = `${props.client.firstName} ${props.client.lastName}`.trim()
  const s = props.sections.summary
  const dobDisplay =
    s.dateOfBirth ||
    (props.client.dateOfBirth ? formatCalendarDate(props.client.dateOfBirth) : '')

  const attachmentsFor = (prefix: string) =>
    props.attachments.filter((a) => a.sectionKey.startsWith(prefix))

  const locations = Object.entries(props.sections.locationSchedule.primaryLocations)
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(', ')

  return (
    <>
      <AssessmentPrintToolbar
        clientId={props.clientId}
        assessmentId={props.assessmentId}
      />

      <table className="print-layout-table">
        <thead>
          <tr>
            <td>
              <div className="print-page-header">
                <div className="brand-mini">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/new-real-logo.png" alt="" />
                  <span>Rise & Shine</span>
                </div>
                <span className="doc-label">Initial Assessment and Treatment Plan</span>
              </div>
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className="print-page-footer">
                <span>{clientName}</span>
                <span className="page-num" />
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
              <div className="print-body">
                <div className="print-cover-block">
                  <div>
                    <h1>{clientName}</h1>
                    <p className="print-client-code">{props.client.clientCode}</p>
                  </div>
                  <div className="print-title-meta">
                    <div>Initial Assessment and Treatment Plan</div>
                    <div>
                      {props.status.replace('_', ' ')} · {props.source}
                    </div>
                  </div>
                </div>

                <PrintSection title="Initial Assessment Summary">
                  <Field label="Patient Name" value={s.patientName} />
                  <Field label="Parent Name" value={s.parentName} />
                  <Field label="Diagnosis" value={s.diagnosis} />
                  <Field label="Comorbid Diagnosis" value={s.comorbidDiagnosis} />
                  <Field label="Date of Birth" value={dobDisplay} />
                  <Field label="Age" value={s.age} />
                  <Field label="Referring / Primary Care Provider" value={s.referringProvider} />
                  <Field label="NPI" value={s.npi} />
                  <Field label="Report Date" value={s.reportDate} />
                  <Field
                    label="Assessor Name"
                    value={`${s.assessorName || ''}${ASSESSOR_CREDENTIALS_SUFFIX}`.trim()}
                  />
                  <Field label="Assessor Email" value={s.assessorEmail} />
                  <Field label="Assessor Phone" value={s.assessorPhone} />
                </PrintSection>

                <PrintSection title="Treatment Requests" pageBreak>
                  <p className="prose-block">{TREATMENT_REQUESTS_INTRO}</p>
                  <Field label="97151 — Initial assessment (hrs per auth period)" value={props.sections.treatmentRequest.hrs97151} />
                  <Field label="97153 — Direct 1:1 ABA (initial weekly hrs)" value={props.sections.treatmentRequest.hrs97153Initial} />
                  <Field label="97155 — BCBA supervision (initial weekly hrs)" value={props.sections.treatmentRequest.hrs97155Initial} />
                  <Field label="97156 — Parent / caregiver training" value={props.sections.treatmentRequest.hrs97156} />
                  <Field label="97157 — Group parent training (monthly hrs)" value={props.sections.treatmentRequest.hrs97157} />
                  <Field label="Service Period" value={props.sections.treatmentRequest.servicePeriod} />
                </PrintSection>

                <PrintSection title="Location of Services & Schedule" pageBreak>
                  <p className="prose-block">{LOCATION_OF_SERVICES_INTRO}</p>
                  <p className="prose-block">{LOCATION_OF_SERVICES_BACB_QUOTE}</p>
                  <Field label="Primary Locations" value={locations || 'None selected'} />
                  <ScheduleTable rows={props.sections.locationSchedule.scheduleRows} />
                </PrintSection>

                <PrintSection title="Bio-Psychosocial Information" pageBreak>
                  <BioField label="General Information" value={props.sections.bioPsychosocial.generalInformation} />
                  <BioField label="Family structure" value={props.sections.bioPsychosocial.familyStructure} />
                  <BioField label="Developmental history" value={props.sections.bioPsychosocial.developmentalHistory} />
                  <BioField label="Medical History" value={props.sections.bioPsychosocial.medicalHistory} />
                  <BioField label="Reason for Assessment" value={props.sections.bioPsychosocial.reasonForAssessment} />
                  <BioField label="Medications" value={props.sections.bioPsychosocial.medications} />
                  <BioField label="Allergies" value={props.sections.bioPsychosocial.allergies} />
                  <BioField label="Family history of autism" value={props.sections.bioPsychosocial.familyHistoryOfAutism} />
                  <BioField label="Educational Setting" value={props.sections.bioPsychosocial.educationalSetting} />
                  <BioField label="Parent Level of Involvement & Family Support System" value={props.sections.bioPsychosocial.parentInvolvement} />
                </PrintSection>

                <PrintSection title="Instruments & Methods" pageBreak>
                  <Block title="Family/caregiver(s) interview" text={props.sections.instruments.familyCaregiverInterview} />
                  <Block title="Records reviewed" text={props.sections.instruments.recordsReviewed} />
                  <Field label="Vineland completed by parent on" value={props.sections.instruments.vinelandCompletedDate} />
                  <Block title="Behavior Assessment (FAST)" text={props.sections.instruments.fastAssessment} />
                  <Block title="Autism Treatment Evaluation Checklist (ATEC)" text={props.sections.instruments.atecAssessment} />
                  <Block title="Observation 1" text={props.sections.instruments.observation1} />
                  <Block title="Observation 2" text={props.sections.instruments.observation2} />
                  <Block title="Preference Assessment" text={props.sections.instruments.preferenceAssessment} />
                </PrintSection>

                <PrintSection title="Present Levels of Performance" pageBreak>
                  {(['vineland', 'atec', 'fast'] as const).map((key) => (
                    <div key={key} className="section-block">
                      <p className="subheading">{key === 'vineland' ? 'Vineland' : key.toUpperCase()}</p>
                      {key === 'vineland' && (
                        <Field label="Date" value={props.sections.presentLevels.vineland.date} />
                      )}
                      <AttachmentImages
                        attachments={attachmentsFor(`present_levels.${key}`)}
                        urls={props.attachmentUrls}
                      />
                      <Block title="Interpretation" text={props.sections.presentLevels[key].interpretation} />
                    </div>
                  ))}
                  <AttachmentImages
                    attachments={attachmentsFor('present_levels.extra')}
                    urls={props.attachmentUrls}
                    label="Additional attachments"
                  />
                </PrintSection>

                <PrintSection title="Environmental Barriers" pageBreak>
                  <Block text={props.sections.environmental.barriers} />
                </PrintSection>

                <PrintSection title="Response to Treatment">
                  <Block text={props.sections.responseToTx.narrative} />
                </PrintSection>

                <PrintSection title="97155 Interventions & Barriers to Treatment" pageBreak>
                  <Block text={props.sections.interventions.narrative || INTERVENTIONS_97155_DEFAULT} />
                </PrintSection>

                <PrintSection title="Functional Behavior Assessment & BIP" pageBreak>
                  {props.sections.behaviors.blocks.map((b, i) => (
                    <div key={b.id} className="section-block">
                      <p className="subheading">Behavior {i + 1}</p>
                      <Field label="Operational Definition" value={b.operationalDefinition} />
                      <Field label="Severity" value={b.severity} />
                      <Field label="Example" value={b.example} />
                      <Field label="Non-example" value={b.nonExample} />
                      <Field label="Hypothesized Function" value={b.hypothesizedFunction} />
                      <Field label="Onset" value={b.onset} />
                      <Field label="Offset" value={b.offset} />
                      <Field label="Measurement" value={b.measurement} />
                      <Block title="Baseline Measurement/Graph" text={b.baselineMeasurement} />
                      <AttachmentImages
                        attachments={attachmentsFor(`behaviors[${i}]`)}
                        urls={props.attachmentUrls}
                      />
                      <Block title="Intervention Plans" text={b.interventionPlans} />
                      <Block title="Prevention Strategies" text={b.preventionStrategies} />
                      <Block title="Replacement Strategies" text={b.replacementStrategies} />
                      <Block title="Response Strategies" text={b.responseStrategies} />
                      <Block title="Antecedents / Setting Events" text={b.antecedentsSettingEvents} />
                    </div>
                  ))}
                </PrintSection>

                <PrintSection title="Treatment Goals" pageBreak>
                  <Block text={props.sections.goals.behaviorReduction.analysisNarrative} />
                  <GoalTableA title="Behavior Reduction Goals" rows={props.sections.goals.behaviorReduction.rows} />
                  <Block title="Current level of communication skills" text={props.sections.goals.communication.currentLevel} />
                  <GoalTableA title="Communication Goals" rows={props.sections.goals.communication.rows} />
                  <Block title="Current level of social skills" text={props.sections.goals.social.currentLevel} />
                  <GoalTableA title="Social Interaction & Social Communication Goals" rows={props.sections.goals.social.rows} />
                  <Block title="Current level of adaptive skills" text={props.sections.goals.adaptive.currentLevel} />
                  <GoalTableA title="Adaptive Skills" rows={props.sections.goals.adaptive.rows} />
                  <Block title="Current level of living / self-help skills" text={props.sections.goals.livingSelfHelp.currentLevel} />
                  <GoalTableA title="Living / Self-Help Skills" rows={props.sections.goals.livingSelfHelp.rows} />
                </PrintSection>

                <PrintSection title="Parent Training" pageBreak>
                  <Block text={props.sections.parentTraining.summaryNarrative} />
                  <GoalTableB title="Parent Training Goals" rows={props.sections.parentTraining.summaryGoals} />
                  <Block text={props.sections.parentTraining.groupClinicalRationale} />
                  <GoalTableB title="Group Parent Training Goals" rows={props.sections.parentTraining.groupGoals} />
                  <p className="prose-block">{GROUP_PARENT_TRAINING_GRAPHS_NOTE}</p>
                </PrintSection>

                <PrintSection title="Services Protocols & Details" pageBreak>
                  <Block text={props.sections.servicesProtocols.directionOfTechnician} />
                  <Block text={props.sections.servicesProtocols.coordinationOfCare} />
                  <Block title="Coordination contacts" text={props.sections.servicesProtocols.coordinationContacts} />
                  <Block text={props.sections.servicesProtocols.parentTraining} />
                  <Block text={props.sections.servicesProtocols.groupParentTraining} />
                  <Block text={props.sections.servicesProtocols.reAssessment} />
                  <Block text={props.sections.servicesProtocols.generalizationTransition} />
                </PrintSection>

                <PrintSection title="Transition Plan" pageBreak>
                  <Block text={props.sections.transitionPlan.maintenanceGeneralization} />
                  <Block text={props.sections.transitionPlan.transitionPlanNarrative} />
                  <Block text={props.sections.transitionPlan.communicationCriteria} />
                  <Block text={props.sections.transitionPlan.socialCriteria} />
                  <TransitionTable rows={props.sections.transitionPlan.criteriaRows} />
                  <Block text={props.sections.transitionPlan.dischargeNarrative} />
                </PrintSection>

                <PrintSection title="Coordination with Team" pageBreak>
                  <ContactBlock label="Speech Therapist" contact={props.sections.coordination.speechTherapist} />
                  <ContactBlock label="Occupational Therapist" contact={props.sections.coordination.occupationalTherapist} />
                  <ContactBlock label="Class teacher" contact={props.sections.coordination.classTeacher} />
                  <ContactBlock label="Physical Therapist" contact={props.sections.coordination.physicalTherapist} />
                  <ContactBlock label="Primary care provider" contact={props.sections.coordination.primaryCareProvider} />
                  <Block text={props.sections.coordination.treatmentPlanReview} />
                </PrintSection>

                <PrintSection title="Recommendations for Treatment" pageBreak>
                  <Block text={props.sections.recommendations.narrative} />
                </PrintSection>

                <PrintSection title="Emergency Response / Crisis Plan" pageBreak>
                  <p className="subheading">Please check risk factors as applicable:</p>
                  {CRISIS_RISK_FACTOR_OPTIONS.map((key) => {
                    const checked = props.sections.crisisPlan.riskFactors[key as keyof typeof props.sections.crisisPlan.riskFactors]
                    return (
                      <p key={key} className="checkbox-line">
                        {checked ? '☒' : '☐'} {CRISIS_LABELS[key]}
                      </p>
                    )
                  })}
                  {props.sections.crisisPlan.riskFactors.other && props.sections.crisisPlan.riskFactors.otherText && (
                    <Field label="Other (specify)" value={props.sections.crisisPlan.riskFactors.otherText} />
                  )}
                  <Block text={CRISIS_ESCALATION_INSTRUCTIONS} />
                </PrintSection>

                <PrintSection title="Signatures" pageBreak>
                  {SIGNATURE_BLOCKS.map(({ key, title, purpose }) => {
                    const sig = props.sections.signatures[key]
                    return (
                      <div key={key} className="signature-card">
                        <h4>{title}</h4>
                        <p className="signature-purpose">{purpose}</p>
                        <Field label="Name" value={sig.name} always />
                        <Field label="Credentials" value={sig.credentials || (key === 'bcba' ? 'BCBA/LBA' : undefined)} always />
                        {sig.signatureData ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sig.signatureData} alt={`${title} signature`} className="signature-img" />
                        ) : (
                          <Field label="Signature (typed)" value={sig.signatureTypedName} always />
                        )}
                        <Field label="Date" value={sig.date} always />
                      </div>
                    )
                  })}
                </PrintSection>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function PrintSection({
  title,
  pageBreak,
  children,
}: {
  title: string
  pageBreak?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`print-section${pageBreak ? ' page-break-before' : ''}`}>
      <div className="section-band">{title}</div>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  always,
}: {
  label: string
  value?: string | null
  always?: boolean
}) {
  if (!always && !value?.trim()) return null
  return (
    <div className="field-grid">
      <span className="field-label">{label}</span>
      <span className="field-value">{value?.trim() || '—'}</span>
    </div>
  )
}

function Block({ title, text }: { title?: string; text?: string }) {
  if (!text?.trim()) return null
  return (
    <div className="section-block">
      {title && <p className="subheading">{title}</p>}
      <p className="prose-block">{text}</p>
    </div>
  )
}

function BioField({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null
  return (
    <div className="section-block">
      <p className="subheading">{label}</p>
      <p className="prose-block">{value}</p>
    </div>
  )
}

function AttachmentImages({
  attachments,
  urls,
  label,
}: {
  attachments: Props['attachments']
  urls: Record<string, string>
  label?: string
}) {
  const imgs = attachments.filter((a) => urls[a.id])
  if (imgs.length === 0) return null
  return (
    <div className="section-block">
      {label && <p className="subheading">{label}</p>}
      <div className="print-image-grid">
        {imgs.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={urls[a.id]} alt={a.fileName} />
        ))}
      </div>
    </div>
  )
}

function ScheduleTable({
  rows,
}: {
  rows: AssessmentSectionData['locationSchedule']['scheduleRows']
}) {
  if (rows.length === 0) return null
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th>Service</th>
          {dayLabels.map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.label || row.serviceCode}</td>
            {days.map((d) => (
              <td key={d}>{row.schedule[d] || '—'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GoalTableA({
  title,
  rows,
}: {
  title: string
  rows: AssessmentSectionData['goals']['behaviorReduction']['rows']
}) {
  if (rows.length === 0) return null
  return (
    <div className="section-block">
      <p className="subheading">{title}</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Goal Name</th>
            <th>Objective</th>
            <th>Baseline</th>
            <th>Previous Score</th>
            <th>Current</th>
            <th>Mastery Criteria</th>
            <th>Target Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.goalName || '—'}</td>
              <td>{r.objective || '—'}</td>
              <td>{r.baseline || '—'}</td>
              <td>{r.previousAssessmentScore || '—'}</td>
              <td>{r.currentPerformance || '—'}</td>
              <td>{r.masteryCriteria || '—'}</td>
              <td>{r.targetMasteryDate || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GoalTableB({
  title,
  rows,
}: {
  title: string
  rows: AssessmentSectionData['parentTraining']['summaryGoals']
}) {
  if (rows.length === 0) return null
  return (
    <div className="section-block">
      <p className="subheading">{title}</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Goal</th>
            <th>Baseline</th>
            <th>Previous</th>
            <th>Current</th>
            <th>Mastery Criteria</th>
            <th>Target Date</th>
            <th>Methods</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.goal || '—'}</td>
              <td>{r.baselinePerformance || '—'}</td>
              <td>{r.previousAssessmentPerformance || '—'}</td>
              <td>{r.currentPerformance || '—'}</td>
              <td>{r.masteryCriteria || '—'}</td>
              <td>{r.targetMasteryDate || '—'}</td>
              <td>{r.methodsToBeUtilized || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TransitionTable({
  rows,
}: {
  rows: AssessmentSectionData['transitionPlan']['criteriaRows']
}) {
  if (rows.length === 0) return null
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th>Criteria</th>
          <th>Direct Hours Change to</th>
          <th>Parent Training Increase</th>
          <th>Supervision Decrease</th>
          <th>Date Expected</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.criteria || '—'}</td>
            <td>{r.directHoursChangeTo || '—'}</td>
            <td>{r.parentTrainingIncrease || '—'}</td>
            <td>{r.supervisionDecrease || '—'}</td>
            <td>{r.dateExpected || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ContactBlock({
  label,
  contact,
}: {
  label: string
  contact: AssessmentSectionData['coordination']['speechTherapist']
}) {
  if (!contact.name && !contact.organization && !contact.phone && !contact.email) return null
  return (
    <div className="section-block">
      <p className="subheading">{label}</p>
      <Field label="Name" value={contact.name} />
      <Field label="Organization" value={contact.organization} />
      <Field label="Phone" value={contact.phone} />
      <Field label="Email" value={contact.email} />
    </div>
  )
}
