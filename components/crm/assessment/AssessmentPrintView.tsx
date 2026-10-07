import { formatUsMmDdYyyy } from '@/lib/billing/calendarDate'
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
import {
  personalizeAssessmentValue,
  personalizeClientReferences,
} from '@/lib/crm/assessment/personalize'
import {
  aflsLatestProtocolValue,
  aflsLatestSkillAreaValue,
  hasLegacyAtecData,
  selectedSkillsAssessmentLabel,
} from '@/lib/crm/assessment/afls'
import type { TreatmentAssessmentStatus, TreatmentAssessmentSource } from '@prisma/client'
import { AssessmentPrintPager } from '@/components/crm/assessment/AssessmentPrintPager'
import { assessmentDocumentTitle, isReassessment } from '@/lib/crm/assessment/assessmentType'
import { GOAL_STATUS_LABELS, goalProgressSummary } from '@/lib/crm/assessment/reassessment'
import { GOAL_STATUSES, type GoalStatus } from '@/lib/crm/assessment/assessment.schema'

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
  assessmentType?: string
  basePath?: '/portal' | '/client-services'
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
      'The supervising BCBA certifies this {document} is accurate and approves recommended services.',
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
  const documentTitle = assessmentDocumentTitle(props.assessmentType)
  const sections = personalizeAssessmentValue(props.sections, clientName)
  const s = sections.summary
  const isRe = isReassessment(props.assessmentType)
  const re = sections.reassessment
  const progress = isRe ? goalProgressSummary(sections) : null
  const displayDate = (value?: string | Date | null) =>
    formatUsMmDdYyyy(value) || ''

  const dobDisplay =
    displayDate(s.dateOfBirth) ||
    displayDate(props.client.dateOfBirth)

  const attachmentsFor = (prefix: string) =>
    props.attachments.filter((a) => a.sectionKey.startsWith(prefix))
  const selectedSkillsLabel = selectedSkillsAssessmentLabel(sections.instruments)
  const showLegacyAtec = hasLegacyAtecData(
    sections.instruments,
    sections.presentLevels.atec.interpretation,
    attachmentsFor('present_levels.atec').length
  )

  const locations = Object.entries(sections.locationSchedule.primaryLocations)
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(', ')

  const copy = (text: string) => personalizeClientReferences(text, clientName)

  const assessorDisplay =
    `${s.assessorName || ''}${ASSESSOR_CREDENTIALS_SUFFIX}`.trim() || '—'

  const dobForFooter = dobDisplay || '—'

  const coverValue = (value?: string | null) => value?.trim() || '—'
  const coverDate = (value?: string | Date | null) =>
    formatUsMmDdYyyy(value) || '—'

  return (
    <AssessmentPrintPager
      clientId={props.clientId}
      assessmentId={props.assessmentId}
      clientName={clientName}
      basePath={props.basePath}
    >
      <section className="assessment-cover">
        {/* Keep running elements inside the first page box — a preceding sibling
            can make Paged.js emit a blank sheet before the cover. */}
        <span className="running-client" aria-hidden="true">
          {clientName} · DOB {dobForFooter}
        </span>
        <div className="running-header-brand" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="running-header-logo"
            src="/brand/rise-and-shine-logo.png"
            alt=""
          />
          <span className="running-header-name">Rise &amp; Shine</span>
        </div>
        <div className="assessment-cover-toprule" aria-hidden="true" />
        <div className="assessment-cover-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="assessment-cover-logo"
            src="/brand/rise-and-shine-logo.png"
            alt="Rise & Shine"
          />
          <p className="assessment-cover-eyebrow">CONFIDENTIAL · CLINICAL RECORD</p>
          <h1 className="assessment-cover-title">{documentTitle}</h1>
          <div className="assessment-cover-title-rule" aria-hidden="true" />

          <div className="assessment-cover-summary">
            <div className="assessment-cover-col">
              <CoverField label="Patient Name" value={coverValue(s.patientName || clientName)} />
              <CoverField label="Date of Birth" value={coverDate(dobDisplay || s.dateOfBirth || props.client.dateOfBirth)} />
              <CoverField label="Diagnosis" value={coverValue(s.diagnosis)} />
              {s.comorbidDiagnosis?.trim() ? (
                <CoverField label="Comorbid Diagnosis" value={s.comorbidDiagnosis} />
              ) : null}
              <CoverField label="Parent / Guardian" value={coverValue(s.parentName)} />
              <CoverField label="Report Date" value={coverDate(s.reportDate)} />
              {isRe && (
                <CoverField
                  label="Reporting Period"
                  value={`${coverDate(re.reportingPeriod.periodStart)} – ${coverDate(re.reportingPeriod.periodEnd)}`}
                />
              )}
              <CoverField label="Assessor Name" value={assessorDisplay} />
            </div>
            <div className="assessment-cover-col">
              <CoverField label="Client Code" value={coverValue(props.client.clientCode)} />
              <CoverField label="Age" value={coverValue(s.age)} />
              <CoverField
                label="Referring / PCP"
                value={coverValue(s.referringProvider)}
              />
              <CoverField label="NPI" value={coverValue(s.npi)} />
              <CoverField label="Assessor Email" value={coverValue(s.assessorEmail)} />
              <CoverField label="Assessor Phone" value={coverValue(s.assessorPhone)} />
            </div>
          </div>
        </div>

        <footer className="assessment-cover-company">
          <div>
            <strong>Rise &amp; Shine ABA, LLC</strong>
            <div>1655 Richmond Ave, Staten Island, NY 10314</div>
          </div>
          <div className="assessment-cover-company-right">
            <div>www.riseandshineaba.com</div>
            <div>Autism Treatment Center · Home &amp; Center Based</div>
          </div>
        </footer>
      </section>

      <div className="print-body">
                {isRe && (
                  <PrintSection title="Reassessment Details">
                    <Field label="Reporting period" value={`${displayDate(re.reportingPeriod.periodStart) || '—'} – ${displayDate(re.reportingPeriod.periodEnd) || '—'}`} />
                    <Field label="Authorization number" value={re.reportingPeriod.authorizationNumber} />
                    <Field label="Dates of service covered" value={re.reportingPeriod.datesOfServiceCovered} />

                    <div className="section-block">
                      <p className="subheading">Changes since last assessment</p>
                      <Field label="Diagnosis" value={re.changesSinceLast.diagnosis} always />
                      <Field label="Medications" value={re.changesSinceLast.medications} always />
                      <Field label="School placement" value={re.changesSinceLast.schoolPlacement} always />
                      <Field label="Family circumstances" value={re.changesSinceLast.familyCircumstances} always />
                      <Field label="Team members" value={re.changesSinceLast.teamMembers} always />
                    </div>

                    <div className="section-block">
                      <p className="subheading">Parent / caregiver training</p>
                      <Field
                        label="Sessions delivered"
                        value={
                          re.caregiverTraining.sessionsDelivered === null
                            ? ''
                            : `${re.caregiverTraining.sessionsDelivered} (minimum ${re.caregiverTraining.requiredMinimum})`
                        }
                        always
                      />
                      <Block title="Explanation (below minimum)" text={re.caregiverTraining.belowMinimumExplanation} />
                      <Block title="Mitigation plan" text={re.caregiverTraining.mitigationPlan} />
                      <Block title="Caregiver participation" text={re.caregiverTraining.participationNarrative} />
                    </div>

                    {re.instrumentComparison.length > 0 && (
                      <div className="section-block">
                        <p className="subheading">Standardized instrument comparison</p>
                        <table className="print-table">
                          <thead>
                            <tr>
                              <th>Instrument</th>
                              <th>Prior (date)</th>
                              <th>Prior result</th>
                              <th>Current (date)</th>
                              <th>Current result</th>
                              <th>Interpretation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {re.instrumentComparison.map((r) => (
                              <tr key={r.id}>
                                <td>{r.instrument || '—'}</td>
                                <td>{displayDate(r.priorDate) || '—'}</td>
                                <td>{r.priorResult || '—'}</td>
                                <td>{displayDate(r.currentDate) || '—'}</td>
                                <td>{r.currentResult || '—'}</td>
                                <td>{r.interpretation || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {re.barriersDuringPeriod.length > 0 && (
                      <div className="section-block">
                        <p className="subheading">Barriers encountered this period</p>
                        <table className="print-table">
                          <thead>
                            <tr>
                              <th>Barrier</th>
                              <th>Mitigation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {re.barriersDuringPeriod.map((r) => (
                              <tr key={r.id}>
                                <td>{r.barrier || '—'}</td>
                                <td>{r.mitigation || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="section-block">
                      <p className="subheading">Units requested</p>
                      <table className="print-table">
                        <thead>
                          <tr>
                            <th>CPT</th>
                            <th>Previous request</th>
                            <th>Requested</th>
                            <th>Locations</th>
                            <th>Justification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {re.unitsRequested.map((r) => (
                            <tr key={r.code}>
                              <td>{r.code}</td>
                              <td>{r.previousRequest || '—'}</td>
                              <td>{r.unitsRequested || '—'}</td>
                              <td>
                                {Object.entries(r.locations)
                                  .filter(([, on]) => on)
                                  .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
                                  .join(', ') || '—'}
                              </td>
                              <td>{r.justification || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </PrintSection>
                )}

                <PrintSection title="Treatment Requests">
                  <p className="prose-block">{copy(TREATMENT_REQUESTS_INTRO)}</p>
                  <TreatmentRequestsTable request={sections.treatmentRequest} />
                </PrintSection>

                <PrintSection title="Location of Services & Schedule">
                  <p className="prose-block">{LOCATION_OF_SERVICES_INTRO}</p>
                  <p className="prose-block">{copy(LOCATION_OF_SERVICES_BACB_QUOTE)}</p>
                  <Field label="Primary Locations" value={locations || 'None selected'} />
                  <ScheduleTable rows={sections.locationSchedule.scheduleRows} />
                </PrintSection>

                <PrintSection title="Bio-Psychosocial Information">
                  <BioField label="General Information" value={sections.bioPsychosocial.generalInformation} />
                  <BioField label="Family structure" value={sections.bioPsychosocial.familyStructure} />
                  <BioField label="Developmental history" value={sections.bioPsychosocial.developmentalHistory} />
                  <BioField label="Medical History" value={sections.bioPsychosocial.medicalHistory} />
                  <BioField label="Reason for Assessment" value={sections.bioPsychosocial.reasonForAssessment} />
                  <BioField label="Medications" value={sections.bioPsychosocial.medications} />
                  <BioField label="Allergies" value={sections.bioPsychosocial.allergies} />
                  <BioField label="Family history of autism" value={sections.bioPsychosocial.familyHistoryOfAutism} />
                  <BioField label="Educational Setting" value={sections.bioPsychosocial.educationalSetting} />
                  <BioField label="Parent Level of Involvement & Family Support System" value={sections.bioPsychosocial.parentInvolvement} />
                </PrintSection>

                <PrintSection title="Instruments & Methods">
                  <Block title="Family/caregiver(s) interview" text={sections.instruments.familyCaregiverInterview} />
                  <Block title="Records reviewed" text={sections.instruments.recordsReviewed} />
                  <Field label="Skills assessment instrument" value={selectedSkillsLabel} />
                  <Field label="Vineland completed by parent on" value={displayDate(sections.instruments.vinelandCompletedDate)} />
                  <Block title="Behavior Assessment (FAST)" text={sections.instruments.fastAssessment} />
                  {sections.instruments.skillsAssessmentType === 'AFLS' && (
                    <Block title="Assessment of Functional Living Skills (AFLS)" text={sections.instruments.aflsAssessment} />
                  )}
                  {sections.instruments.skillsAssessmentType === 'ATEC' && (
                    <Block title="Autism Treatment Evaluation Checklist (ATEC)" text={sections.instruments.atecAssessment} />
                  )}
                  {sections.instruments.skillsAssessmentType === 'VB_MAPP' && (
                    <Block title="VB-MAPP" text={sections.instruments.vbMappAssessment} />
                  )}
                  {sections.instruments.skillsAssessmentType === 'OTHER' && (
                    <Block title={selectedSkillsLabel} text={sections.instruments.otherSkillsAssessmentSummary} />
                  )}
                  <Block title="Observation 1" text={sections.instruments.observation1} />
                  <Block title="Observation 2" text={sections.instruments.observation2} />
                  <Block title="Preference Assessment" text={sections.instruments.preferenceAssessment} />
                </PrintSection>

                <PrintSection title="Present Levels of Performance">
                  <div className="section-block">
                    <p className="subheading">Vineland</p>
                    <Field label="Date" value={displayDate(sections.presentLevels.vineland.date)} />
                    <AttachmentImages
                      attachments={attachmentsFor('present_levels.vineland')}
                      urls={props.attachmentUrls}
                    />
                    <AttachmentFileList attachments={attachmentsFor('present_levels.vineland')} />
                    <Block title="Interpretation" text={sections.presentLevels.vineland.interpretation} />
                  </div>
                  {sections.instruments.skillsAssessmentType === 'AFLS' && (
                    <AflsPrintBlock
                      afls={sections.presentLevels.afls}
                      attachments={attachmentsFor('present_levels.afls')}
                      urls={props.attachmentUrls}
                    />
                  )}
                  {sections.instruments.skillsAssessmentType === 'ATEC' && (
                    <div className="section-block">
                      <p className="subheading">ATEC</p>
                      <AttachmentImages
                        attachments={attachmentsFor('present_levels.atec')}
                        urls={props.attachmentUrls}
                      />
                      <AttachmentFileList attachments={attachmentsFor('present_levels.atec')} />
                      <Block title="Interpretation" text={sections.presentLevels.atec.interpretation} />
                    </div>
                  )}
                  {sections.instruments.skillsAssessmentType === 'VB_MAPP' && (
                    <div className="section-block">
                      <p className="subheading">VB-MAPP</p>
                      <AttachmentImages
                        attachments={attachmentsFor('present_levels.vbMapp')}
                        urls={props.attachmentUrls}
                      />
                      <AttachmentFileList attachments={attachmentsFor('present_levels.vbMapp')} />
                      <Block title="Interpretation" text={sections.presentLevels.vbMapp.interpretation} />
                    </div>
                  )}
                  {sections.instruments.skillsAssessmentType === 'OTHER' && (
                    <div className="section-block">
                      <p className="subheading">{selectedSkillsLabel}</p>
                      <AttachmentImages
                        attachments={attachmentsFor('present_levels.other')}
                        urls={props.attachmentUrls}
                      />
                      <AttachmentFileList attachments={attachmentsFor('present_levels.other')} />
                      <Block title="Interpretation" text={sections.presentLevels.other.interpretation} />
                    </div>
                  )}
                  <div className="section-block">
                    <p className="subheading">FAST</p>
                    <AttachmentImages
                      attachments={attachmentsFor('present_levels.fast')}
                      urls={props.attachmentUrls}
                    />
                    <AttachmentFileList attachments={attachmentsFor('present_levels.fast')} />
                    <Block title="Interpretation" text={sections.presentLevels.fast.interpretation} />
                  </div>
                  {sections.instruments.skillsAssessmentType !== 'ATEC' && showLegacyAtec && (
                    <div className="section-block">
                      <p className="subheading">Legacy ATEC</p>
                      <AttachmentImages
                        attachments={attachmentsFor('present_levels.atec')}
                        urls={props.attachmentUrls}
                      />
                      <AttachmentFileList attachments={attachmentsFor('present_levels.atec')} />
                      <Block title="Legacy summary text" text={sections.instruments.atecAssessment} />
                      <Block title="Legacy interpretation" text={sections.presentLevels.atec.interpretation} />
                    </div>
                  )}
                  <AttachmentImages
                    attachments={attachmentsFor('present_levels.extra')}
                    urls={props.attachmentUrls}
                    label="Additional attachments"
                  />
                  <AttachmentFileList
                    attachments={attachmentsFor('present_levels.extra')}
                    label="Additional attachment files"
                  />
                </PrintSection>

                <PrintSection title="Environmental Barriers">
                  <Block text={sections.environmental.barriers} />
                </PrintSection>

                <PrintSection title="Response to Treatment">
                  {progress && (
                    <div className="section-block">
                      <p className="subheading">Goal progress this period</p>
                      <Field
                        label="Summary"
                        value={GOAL_STATUSES.map((st) => `${GOAL_STATUS_LABELS[st]}: ${progress.counts[st]}`).join(' · ')}
                        always
                      />
                      {(['MASTERED', 'IN_PROGRESS', 'MODIFIED', 'DISCONTINUED'] as const).map((st) =>
                        progress.lists[st].length ? (
                          <Field
                            key={st}
                            label={GOAL_STATUS_LABELS[st]}
                            value={progress.lists[st]
                              .map((g) => `${g.table}: ${g.name}${g.rationale && st !== 'MASTERED' ? ` (${g.rationale})` : ''}`)
                              .join('; ')}
                          />
                        ) : null
                      )}
                    </div>
                  )}
                  <Block text={sections.responseToTx.narrative} />
                  {isRe && (
                    <Block
                      title="Rationale for lack of progress, regression, or stagnation"
                      text={sections.responseToTx.lackOfProgressRationale}
                    />
                  )}
                </PrintSection>

                <PrintSection title="97155 Interventions & Barriers to Treatment">
                  <Block text={sections.interventions.narrative || copy(INTERVENTIONS_97155_DEFAULT)} />
                </PrintSection>

                <PrintSection title="Functional Behavior Assessment & BIP">
                  {sections.behaviors.blocks.map((b, i) => (
                    <div key={b.id} className="section-block">
                      <p className="subheading">
                        {b.behaviorName?.trim()
                          ? `Behavior ${i + 1}: ${b.behaviorName.trim()}`
                          : `Behavior ${i + 1}`}
                      </p>
                      <Field label="Behavior" value={b.behaviorName} />
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

                <PrintSection title="Treatment Goals">
                  <Block text={sections.goals.behaviorReduction.analysisNarrative} />
                  <GoalTableA title="Behavior Reduction Goals" rows={sections.goals.behaviorReduction.rows} showStatus={isRe} />
                  <GoalTableA title="Replacement Behavior Goals" rows={sections.goals.replacementBehavior.rows} showStatus={isRe} />
                  <Block title="Current level of communication skills" text={sections.goals.communication.currentLevel} />
                  <GoalTableA title="Communication Goals" rows={sections.goals.communication.rows} showStatus={isRe} />
                  <Block title="Current level of social skills" text={sections.goals.social.currentLevel} />
                  <GoalTableA title="Social Interaction & Social Communication Goals" rows={sections.goals.social.rows} showStatus={isRe} />
                  <Block title="Current level of adaptive skills" text={sections.goals.adaptive.currentLevel} />
                  <GoalTableA title="Adaptive Skills" rows={sections.goals.adaptive.rows} showStatus={isRe} />
                  <Block title="Current level of living / self-help skills" text={sections.goals.livingSelfHelp.currentLevel} />
                  <GoalTableA title="Living / Self-Help Skills" rows={sections.goals.livingSelfHelp.rows} showStatus={isRe} />
                </PrintSection>

                <PrintSection title="Parent Training">
                  <Block text={sections.parentTraining.summaryNarrative} />
                  <GoalTableB title="Parent Training Goals" rows={sections.parentTraining.summaryGoals} showStatus={isRe} />
                  <Block text={sections.parentTraining.groupClinicalRationale} />
                  <GoalTableB title="Group Parent Training Goals" rows={sections.parentTraining.groupGoals} showStatus={isRe} />
                  <p className="prose-block">{GROUP_PARENT_TRAINING_GRAPHS_NOTE}</p>
                </PrintSection>

                <PrintSection title="Services Protocols & Details">
                  <Block text={sections.servicesProtocols.directionOfTechnician} />
                  <Block text={sections.servicesProtocols.coordinationOfCare} />
                  <Block title="Coordination contacts" text={sections.servicesProtocols.coordinationContacts} />
                  <Block text={sections.servicesProtocols.parentTraining} />
                  <Block text={sections.servicesProtocols.groupParentTraining} />
                  <Block text={sections.servicesProtocols.reAssessment} />
                  <Block text={sections.servicesProtocols.generalizationTransition} />
                </PrintSection>

                <PrintSection title="Transition Plan">
                  <Block text={sections.transitionPlan.maintenanceGeneralization} />
                  <Block text={sections.transitionPlan.transitionPlanNarrative} />
                  <Block text={sections.transitionPlan.communicationCriteria} />
                  <Block text={sections.transitionPlan.socialCriteria} />
                  <TransitionTable rows={sections.transitionPlan.criteriaRows} />
                  {isRe && (
                    <>
                      <Field
                        label="Criteria reviewed this period"
                        value={
                          sections.transitionPlan.reviewedThisPeriod
                            ? `Yes${sections.transitionPlan.reviewedOn ? ` — ${displayDate(sections.transitionPlan.reviewedOn)}` : ''}`
                            : 'No'
                        }
                        always
                      />
                      <Block title="Review notes" text={sections.transitionPlan.reviewNotes} />
                    </>
                  )}
                  <Block text={sections.transitionPlan.dischargeNarrative} />
                </PrintSection>

                <PrintSection title="Coordination of Care">
                  <CoordinationTable rows={sections.coordination.rows} />
                </PrintSection>

                <PrintSection title="Medical Necessity rational">
                  <Block text={sections.recommendations.narrative} />
                </PrintSection>

                <PrintSection title="Emergency Response / Crisis Plan">
                  <p className="subheading">Please check risk factors as applicable:</p>
                  {CRISIS_RISK_FACTOR_OPTIONS.map((key) => {
                    const checked = sections.crisisPlan.riskFactors[key as keyof typeof sections.crisisPlan.riskFactors]
                    return (
                      <p key={key} className="checkbox-line">
                        {checked ? '☒' : '☐'} {CRISIS_LABELS[key]}
                      </p>
                    )
                  })}
                  {sections.crisisPlan.riskFactors.other && sections.crisisPlan.riskFactors.otherText && (
                    <Field label="Other (specify)" value={sections.crisisPlan.riskFactors.otherText} />
                  )}
                  <Block text={copy(CRISIS_ESCALATION_INSTRUCTIONS)} />
                </PrintSection>

                <PrintSection title="Signatures">
                  {SIGNATURE_BLOCKS.map(({ key, title, purpose }) => {
                    const sig = sections.signatures[key]
                    return (
                      <div key={key} className="signature-card">
                        <h4>{title}</h4>
                        <p className="signature-purpose">
                          {purpose.replace('{document}', documentTitle.replace('&', 'and'))}
                        </p>
                        <Field label="Name" value={sig.name} always />
                        <Field label="Credentials" value={sig.credentials || (key === 'bcba' ? 'BCBA/LBA' : undefined)} always />
                        {sig.signatureData ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sig.signatureData} alt={`${title} signature`} className="signature-img" />
                        ) : (
                          <Field label="Signature (typed)" value={sig.signatureTypedName} always />
                        )}
                        <Field label="Date" value={displayDate(sig.date)} always />
                      </div>
                    )
                  })}
                </PrintSection>
      </div>
    </AssessmentPrintPager>
  )
}

function CoverField({ label, value }: { label: string; value: string }) {
  return (
    <div className="assessment-cover-field">
      <span className="assessment-cover-field-label">{label}</span>
      <span className="assessment-cover-field-value">{value}</span>
    </div>
  )
}

function PrintSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="print-section">
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

function AttachmentFileList({
  attachments,
  label,
}: {
  attachments: Props['attachments']
  label?: string
}) {
  const files = attachments.filter((a) => !/\bimage\//i.test(a.mimeType || ''))
  if (files.length === 0) return null
  return (
    <div className="section-block">
      <p className="subheading">{label || 'Files on record'}</p>
      {files.map((file) => (
        <p key={file.id} className="prose-block">
          {file.fileName}
        </p>
      ))}
    </div>
  )
}

function AflsPrintBlock({
  afls,
  attachments,
  urls,
}: {
  afls: AssessmentSectionData['presentLevels']['afls']
  attachments: Props['attachments']
  urls: Record<string, string>
}) {
  const hasContent =
    afls.interpretation.trim() ||
    afls.protocols.length > 0 ||
    attachments.length > 0
  if (!hasContent) return null

  return (
    <div className="section-block">
      <p className="subheading">AFLS</p>
      <AttachmentImages attachments={attachments} urls={urls} />
      <AttachmentFileList attachments={attachments} />
      <Block title="Interpretation" text={afls.interpretation} />
      <AflsSummaryTables afls={afls} />
    </div>
  )
}

function AflsSummaryTables({
  afls,
}: {
  afls: AssessmentSectionData['presentLevels']['afls']
}) {
  const protocolRows = afls.protocols
    .map((protocol) => ({
      label: protocol.label || protocol.key || 'Protocol',
      value: aflsLatestProtocolValue(protocol),
    }))
    .filter((row) => row.value != null) as { label: string; value: number }[]
  const areaRows = afls.protocols.flatMap((protocol) =>
    protocol.skillAreas
      .map((area) => ({
        label: area.label || area.code || protocol.label || protocol.key || 'Skill area',
        value: aflsLatestSkillAreaValue(area),
      }))
      .filter((row) => row.value != null) as { label: string; value: number }[]
  )

  return (
    <>
      {protocolRows.length > 0 && <AflsBarTable title="Protocol summary scores" rows={protocolRows} />}
      {areaRows.length > 0 && <AflsBarTable title="Skill-area summary scores" rows={areaRows} />}
      {afls.protocols.map((protocol) => (
        <div key={protocol.id} className="section-block">
          <p className="subheading">{protocol.label || protocol.key || 'Protocol'}</p>
          {protocol.skillAreas.map((area) =>
            area.skills.length > 0 ? (
              <AflsSkillGridPrint
                key={area.id}
                title={area.label || area.code || 'Skill area'}
                area={area}
              />
            ) : null
          )}
        </div>
      ))}
    </>
  )
}

function AflsBarTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: number }[]
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="section-block">
      <p className="subheading">{title}</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Area</th>
            <th>Graph</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.label}`}>
              <td>{row.label}</td>
              <td>
                <div style={{ height: 12, background: '#f3ede7', borderRadius: 9999 }}>
                  <div
                    style={{
                      height: 12,
                      width: `${Math.max(4, (row.value / max) * 100)}%`,
                      background: '#f97316',
                      borderRadius: 9999,
                    }}
                  />
                </div>
              </td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AflsSkillGridPrint({
  title,
  area,
}: {
  title: string
  area: AssessmentSectionData['presentLevels']['afls']['protocols'][number]['skillAreas'][number]
}) {
  const dates = [...new Set(area.skills.flatMap((skill) => skill.scores.map((score) => score.date).filter(Boolean)))].sort()
  if (area.skills.length === 0 || dates.length === 0) return null

  return (
    <div className="section-block">
      <p className="subheading">{title}</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Skill</th>
            {dates.map((date) => (
              <th key={date}>{formatUsMmDdYyyy(date) || date}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {area.skills.map((skill) => (
            <tr key={skill.id}>
              <td>{[skill.code, skill.label].filter(Boolean).join(' · ') || 'Skill'}</td>
              {dates.map((date) => {
                const score = skill.scores.find((entry) => entry.date === date)?.value
                return <td key={date}>{score == null ? '—' : String(score)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
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

function TreatmentRequestsTable({
  request,
}: {
  request: AssessmentSectionData['treatmentRequest']
}) {
  const rows: { code: string; service: string; hours: string }[] = [
    {
      code: '97151',
      service: 'Initial assessment (hrs per auth period)',
      hours: request.hrs97151,
    },
    {
      code: '97153',
      service: 'Direct 1:1 ABA (initial weekly hrs)',
      hours: request.hrs97153Initial,
    },
    {
      code: '97155',
      service: 'BCBA supervision (initial weekly hrs)',
      hours: request.hrs97155Initial,
    },
    {
      code: '97156',
      service: 'Parent / caregiver training',
      hours: request.hrs97156,
    },
    {
      code: '97157',
      service: 'Group parent training (monthly hrs)',
      hours: request.hrs97157,
    },
  ]

  return (
    <div className="section-block">
      <table className="print-table">
        <thead>
          <tr>
            <th>CPT Code</th>
            <th>Service</th>
            <th>Hours / Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td>{row.service}</td>
              <td>{row.hours?.trim() || '—'}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              <strong>Service Period</strong>
            </td>
            <td>{request.servicePeriod?.trim() || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function goalStatusCell(r: { status: string; dateMastered: string; rationale: string }) {
  if (!r.status) return '—'
  const label = GOAL_STATUS_LABELS[r.status as GoalStatus]
  const date = r.status === 'MASTERED' && r.dateMastered ? ` (${formatUsMmDdYyyy(r.dateMastered) || r.dateMastered})` : ''
  const why = r.rationale ? ` — ${r.rationale}` : ''
  return `${label}${date}${why}`
}

function GoalTableA({
  title,
  rows,
  showStatus,
}: {
  title: string
  rows: AssessmentSectionData['goals']['behaviorReduction']['rows']
  showStatus?: boolean
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
            {showStatus && <th>Status</th>}
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
              <td>{formatUsMmDdYyyy(r.targetMasteryDate) || r.targetMasteryDate || '—'}</td>
              {showStatus && <td>{goalStatusCell(r)}</td>}
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
  showStatus,
}: {
  title: string
  rows: AssessmentSectionData['parentTraining']['summaryGoals']
  showStatus?: boolean
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
            {showStatus && <th>Status</th>}
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
              <td>{formatUsMmDdYyyy(r.targetMasteryDate) || r.targetMasteryDate || '—'}</td>
              <td>{r.methodsToBeUtilized || '—'}</td>
              {showStatus && <td>{goalStatusCell(r)}</td>}
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
            <td>{formatUsMmDdYyyy(r.dateExpected) || r.dateExpected || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CoordinationTable({
  rows,
}: {
  rows: AssessmentSectionData['coordination']['rows']
}) {
  if (!rows.length) return null
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone Number</th>
          <th>Date</th>
          <th>What was discussed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.name || '—'}</td>
            <td>{row.phone || '—'}</td>
            <td>{formatUsMmDdYyyy(row.date) || row.date || '—'}</td>
            <td>{row.discussion || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
