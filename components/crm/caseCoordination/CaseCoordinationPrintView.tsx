import {
  CASE_COORDINATION_BILLING_GUIDELINES,
  CASE_COORDINATION_CLINICAL_COMPLIANCE,
  CASE_COORDINATION_CONTACT_EMAIL,
  CASE_COORDINATION_CONTACT_PROMPT,
  CASE_COORDINATION_INTRO,
  CASE_COORDINATION_POLICY_INTRO,
  CASE_COORDINATION_POLICY_ITEMS,
  CASE_COORDINATION_TAGLINE,
} from '@/lib/crm/caseCoordination/boilerplate'
import type { CaseCoordinationDocumentPayload } from '@/lib/crm/caseCoordination/resolve'
import { CaseCoordinationPrintToolbar } from '@/components/crm/caseCoordination/CaseCoordinationPrintToolbar'

type Props = {
  clientId: string
  recordId: string
  document: CaseCoordinationDocumentPayload
  status: string
  embedded?: boolean
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-field-grid">
      <span className="cc-field-label">{label}</span>
      <span className="cc-field-value">{value}</span>
    </div>
  )
}

export function CaseCoordinationPrintView({
  clientId,
  recordId,
  document,
  status,
  embedded,
}: Props) {
  const d = document

  return (
    <>
      {!embedded && (
        <CaseCoordinationPrintToolbar clientId={clientId} recordId={recordId} />
      )}
      <div className="case-coord-body">
        <div className="case-coord-letterhead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/new-real-logo.png" alt="" />
          <div>
            <h1>Rise &amp; Shine</h1>
            <p>{CASE_COORDINATION_TAGLINE}</p>
          </div>
        </div>

        <p className="case-coord-intro">{CASE_COORDINATION_INTRO}</p>

        <div className="cc-section-band orange">CLIENT INFORMATION</div>
        <Field label="Client Name:" value={d.clientName} />
        <Field label="Service Address:" value={d.serviceAddress} />
        <Field label="Start Date:" value={d.startDate?.trim() ? d.startDate : '—'} />
        <Field label="Parent/Guardian Name:" value={d.parentGuardianName} />
        <Field label="Parent Email Address:" value={d.parentEmail} />
        <Field label="Parent Contact Number:" value={d.parentContactNumber} />

        <div className="cc-section-band orange">SUPERVISING BCBA INFORMATION</div>
        <Field label="BCBA Name:" value={d.bcbaName} />
        <Field label="Contact Number:" value={d.bcbaContactNumber} />
        <Field label="Email Address:" value={d.bcbaEmail} />

        <div className="cc-section-band cyan">BEHAVIOR TECHNICIAN INFORMATION</div>
        <table className="cc-bt-table">
          <thead>
            <tr>
              <th>Behavior Technician</th>
              <th>Phone Number/Email</th>
              <th>Schedule</th>
              <th>Start Date</th>
            </tr>
          </thead>
          <tbody>
            {d.behaviorTechnicians.length === 0 ? (
              <tr>
                <td colSpan={4}>Not yet assigned</td>
              </tr>
            ) : (
              d.behaviorTechnicians.map((row) => (
                <tr key={row.id ?? row.behaviorTechnician}>
                  <td>{row.behaviorTechnician}</td>
                  <td>{row.phoneEmail ?? '—'}</td>
                  <td>{row.schedule ?? '—'}</td>
                  <td>{row.startDate ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="cc-section-band orange">CASE COORDINATOR INFORMATION</div>
        <Field label="Name:" value={d.coordinatorName} />
        <Field label="Contact Number:" value={d.coordinatorContactNumber} />
        <Field label="Email Address:" value={d.coordinatorEmail} />

        <div className="cc-static-box">
          <h3>BILLING &amp; SESSION GUIDELINES</h3>
          <ul>
            {CASE_COORDINATION_BILLING_GUIDELINES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="cc-static-box">
          <h3>POLICY REMINDER</h3>
          <p>{CASE_COORDINATION_POLICY_INTRO}</p>
          <ul>
            {CASE_COORDINATION_POLICY_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="cc-static-box">
          <h3>CLINICAL COMPLIANCE STATEMENT</h3>
          <p>{CASE_COORDINATION_CLINICAL_COMPLIANCE}</p>
          <p>
            {CASE_COORDINATION_CONTACT_PROMPT}{' '}
            <strong>{CASE_COORDINATION_CONTACT_EMAIL}</strong>
          </p>
        </div>

        {status === 'CONFIRMED' && (
          <p style={{ color: '#6b5e54', fontSize: '9pt', marginTop: 24 }}>
            Confirmed case coordination record — snapshot frozen at sign-off.
          </p>
        )}
      </div>
    </>
  )
}
