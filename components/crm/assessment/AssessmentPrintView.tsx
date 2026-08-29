'use client'

import { useEffect } from 'react'
import { formatCalendarDate } from '@/lib/billing/calendarDate'
import {
  ASSESSOR_CREDENTIALS_SUFFIX,
  CRISIS_ESCALATION_INSTRUCTIONS,
  GROUP_PARENT_TRAINING_GRAPHS_NOTE,
  LOCATION_OF_SERVICES_BACB_QUOTE,
  LOCATION_OF_SERVICES_INTRO,
  TREATMENT_REQUESTS_INTRO,
} from '@/lib/crm/assessment/boilerplate'
import type { AssessmentSectionData } from '@/lib/crm/assessment/assessment.schema'
import type { TreatmentAssessmentStatus, TreatmentAssessmentSource } from '@prisma/client'

type Props = {
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

export function AssessmentPrintView({
  client,
  sections,
  attachments,
  attachmentUrls,
  status,
  source,
}: Props) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auto') === '1') {
      window.print()
    }
  }, [])

  const s = sections.summary
  const dobDisplay = s.dateOfBirth || (client.dateOfBirth ? formatCalendarDate(client.dateOfBirth) : '')

  const sectionAttachments = (prefix: string) =>
    attachments.filter((a) => a.sectionKey.startsWith(prefix))

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { margin: 0.75in; }
          .no-print { display: none !important; }
          .print-page-break { break-before: page; }
        }
        body { background: white; color: #2A2019; font-family: Inter, system-ui, sans-serif; }
        .letterhead { border-bottom: 3px solid #E7692C; padding-bottom: 12px; margin-bottom: 24px; }
        .letterhead h1 { font-family: 'Bricolage Grotesque', sans-serif; color: #E7692C; font-size: 22px; margin: 0; }
        .section-band { background: #E7692C; color: white; padding: 6px 12px; font-weight: 600; margin: 20px 0 10px; font-family: 'Bricolage Grotesque', sans-serif; }
        .field-row { display: grid; grid-template-columns: 180px 1fr; gap: 8px; margin-bottom: 6px; font-size: 13px; }
        .field-label { font-weight: 600; }
        .prose-block { white-space: pre-wrap; font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
        .check { font-family: monospace; }
      `}</style>

      <div className="no-print fixed right-4 top-4 z-50 flex gap-2">
        <button type="button" onClick={() => window.print()} className="rounded-md bg-[#E7692C] px-4 py-2 text-sm text-white shadow">
          Save as PDF / Print
        </button>
      </div>

      <div className="mx-auto max-w-[8.5in] p-6 print:p-0">
        <div className="letterhead flex items-end justify-between">
          <div>
            <h1>Rise & Shine</h1>
            <p className="text-sm text-gray-600">Initial Assessment and Treatment Plan</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>{client.firstName} {client.lastName} · {client.clientCode}</p>
            <p>{status} · {source}</p>
          </div>
        </div>

        <div className="section-band">Initial Assessment Summary</div>
        <Field label="Patient Name" value={s.patientName} />
        <Field label="Parent Name" value={s.parentName} />
        <Field label="Diagnosis" value={s.diagnosis} />
        <Field label="Comorbid Diagnosis" value={s.comorbidDiagnosis} />
        <Field label="Date of Birth" value={dobDisplay} />
        <Field label="Age" value={s.age} />
        <Field label="Referring Provider" value={s.referringProvider} />
        <Field label="NPI" value={s.npi} />
        <Field label="Report Date" value={s.reportDate} />
        <Field label="Assessor" value={`${s.assessorName}${ASSESSOR_CREDENTIALS_SUFFIX}`} />
        <Field label="Email" value={s.assessorEmail} />
        <Field label="Phone" value={s.assessorPhone} />

        <div className="section-band print-page-break">Treatment Requests</div>
        <p className="prose-block">{TREATMENT_REQUESTS_INTRO}</p>
        <Field label="97151 Initial assessment" value={sections.treatmentRequest.hrs97151} />
        <Field label="97153 Direct 1:1" value={sections.treatmentRequest.hrs97153Initial} />
        <Field label="97155 BCBA supervision" value={sections.treatmentRequest.hrs97155Initial} />
        <Field label="97156 Parent training" value={sections.treatmentRequest.hrs97156} />
        <Field label="97157 Group parent training" value={sections.treatmentRequest.hrs97157} />
        <Field label="Service Period" value={sections.treatmentRequest.servicePeriod} />

        <div className="section-band print-page-break">Location of Services & Schedule</div>
        <p className="prose-block">{LOCATION_OF_SERVICES_INTRO}</p>
        <p className="prose-block">{LOCATION_OF_SERVICES_BACB_QUOTE}</p>
        <p className="prose-block">
          Primary Locations: {Object.entries(sections.locationSchedule.primaryLocations)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ') || 'None selected'}
        </p>

        <div className="section-band print-page-break">Bio-Psychosocial Information</div>
        {Object.entries(sections.bioPsychosocial).map(([k, v]) => (
          <Block key={k} title={k.replace(/([A-Z])/g, ' $1')} text={v as string} />
        ))}

        <div className="section-band print-page-break">Instruments & Methods</div>
        <Block title="Family/caregiver interview" text={sections.instruments.familyCaregiverInterview} />
        <Block title="Records reviewed" text={sections.instruments.recordsReviewed} />
        <Block title="Vineland date" text={sections.instruments.vinelandCompletedDate} />
        <Block title="FAST" text={sections.instruments.fastAssessment} />
        <Block title="ATEC" text={sections.instruments.atecAssessment} />
        <Block title="Observation 1" text={sections.instruments.observation1} />
        <Block title="Observation 2" text={sections.instruments.observation2} />
        <Block title="Preference Assessment" text={sections.instruments.preferenceAssessment} />

        <div className="section-band print-page-break">Present Levels</div>
        {(['vineland', 'atec', 'fast'] as const).map((key) => (
          <div key={key} className="mb-4">
            <p className="font-semibold capitalize">{key}</p>
            {sectionAttachments(`present_levels.${key}`).map((a) =>
              attachmentUrls[a.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={a.id} src={attachmentUrls[a.id]} alt={a.fileName} className="my-2 max-h-48 border" />
              ) : null
            )}
            <Block title="Interpretation" text={sections.presentLevels[key].interpretation} />
          </div>
        ))}

        <div className="section-band print-page-break">Environmental Barriers</div>
        <Block text={sections.environmental.barriers} />

        <div className="section-band">Response to Treatment</div>
        <Block text={sections.responseToTx.narrative} />

        <div className="section-band print-page-break">97155 Interventions</div>
        <Block text={sections.interventions.narrative} />

        <div className="section-band print-page-break">FBA / BIP</div>
        {sections.behaviors.blocks.map((b, i) => (
          <div key={b.id} className="mb-6 border-b pb-4">
            <p className="font-semibold">Behavior {i + 1}</p>
            <Block title="Operational Definition" text={b.operationalDefinition} />
            <Block title="Baseline" text={b.baselineMeasurement} />
            {sectionAttachments(`behaviors[${i}]`).map((a) =>
              attachmentUrls[a.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={a.id} src={attachmentUrls[a.id]} alt={a.fileName} className="my-2 max-h-40 border" />
              ) : null
            )}
          </div>
        ))}

        <div className="section-band print-page-break">Treatment Goals</div>
        <Block text={sections.goals.behaviorReduction.analysisNarrative} />

        <div className="section-band print-page-break">Parent Training</div>
        <Block text={sections.parentTraining.summaryNarrative} />
        <p className="prose-block text-sm">{GROUP_PARENT_TRAINING_GRAPHS_NOTE}</p>

        <div className="section-band print-page-break">Services Protocols</div>
        <Block text={sections.servicesProtocols.directionOfTechnician} />
        <Block text={sections.servicesProtocols.coordinationContacts} />

        <div className="section-band print-page-break">Transition Plan</div>
        <Block text={sections.transitionPlan.maintenanceGeneralization} />
        <Block text={sections.transitionPlan.transitionPlanNarrative} />
        <Block text={sections.transitionPlan.dischargeNarrative} />

        <div className="section-band print-page-break">Recommendations</div>
        <Block text={sections.recommendations.narrative} />

        <div className="section-band print-page-break">Crisis Plan</div>
        <p className="prose-block">
          Risk factors: {Object.entries(sections.crisisPlan.riskFactors)
            .filter(([k, v]) => v === true && k !== 'otherText')
            .map(([k]) => k)
            .join(', ') || 'None'}
        </p>
        <p className="prose-block">{CRISIS_ESCALATION_INSTRUCTIONS}</p>

        <div className="section-band print-page-break">Signatures</div>
        {(['bcba', 'graduatePermit', 'parentGuardian'] as const).map((role) => (
          <div key={role} className="mb-6">
            <Field label="Name" value={sections.signatures[role].name} />
            <Field label="Credentials" value={sections.signatures[role].credentials} />
            {sections.signatures[role].signatureData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sections.signatures[role].signatureData} alt="Signature" className="max-h-16" />
            ) : (
              <Field label="Signed" value={sections.signatures[role].signatureTypedName} />
            )}
            <Field label="Date" value={sections.signatures[role].date} />
          </div>
        ))}
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Block({ title, text }: { title?: string; text?: string }) {
  if (!text?.trim()) return null
  return (
    <div className="mb-3">
      {title && <p className="text-sm font-semibold">{title}</p>}
      <p className="prose-block">{text}</p>
    </div>
  )
}
