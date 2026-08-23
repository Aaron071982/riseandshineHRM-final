import type { CrmRole } from '@prisma/client'

export type TrainingStepSeed = {
  stepNumber: number
  slug: string
  title: string
  body: string
  icon?: string
}

export type TrainingModuleSeed = {
  crmRole: CrmRole
  title: string
  summary?: string
  goalStatement?: string
  steps: TrainingStepSeed[]
}

function ccStep(
  n: number,
  title: string,
  body: string,
  icon?: string
): TrainingStepSeed {
  return {
    stepNumber: n,
    slug: `cc-step-${String(n).padStart(2, '0')}`,
    title,
    body,
    icon,
  }
}

const CASE_COORDINATION_STEPS: TrainingStepSeed[] = [
  ccStep(
    1,
    'Assigned client',
    'You are assigned a client by a manager in Admin Management or through an ASSIGNED grant on the client record. Assignments consider language, availability, and caseload balance.',
    'UserCheck'
  ),
  ccStep(
    2,
    'Review CRM progress',
    'Open the Case Coordination department queue and the client profile in Rise & Shine CRM. Review the stage stepper, requirements gate, and activity log to understand where the family is in the pipeline.',
    'LayoutDashboard'
  ),
  ccStep(
    3,
    'Audit intake & documents',
    'On the Requirements and Documents tabs, verify intake form, consent, insurance card, referral validity, and other intake-team work. Flag gaps before advancing the client.',
    'FileSearch'
  ),
  ccStep(
    4,
    'Introduce yourself to the family',
    'Contact the parent/guardian using the email on the client record. Introduce yourself as their Case Coordinator and main point of contact for ABA services at Rise & Shine.',
    'Mail'
  ),
  ccStep(
    5,
    'Collect missing documents',
    'Use the Documents tab to upload or mark required items: insurance card, DSM-5 checklist, psychological evaluation, IEP/IFSP when applicable, signed intake form, and consent.',
    'Upload'
  ),
  ccStep(
    6,
    'Coordinate authorization',
    'For NY Medicaid, follow internal authorization steps on the Authorization tab. For other payers, coordinate with the Billing team (Plutus queue) before services begin.',
    'ShieldCheck'
  ),
  ccStep(
    7,
    'Start / track RBT staffing',
    'On the Staffing tab, request RBT placement via the staffing team. Include address, language/gender preferences, and schedule needs. Confirm the assigned RBT has 40-hour training and credentials on file in HRM.',
    'Users'
  ),
  ccStep(
    8,
    'Identify other services & scheduling conflicts',
    'Ask parents about OT, PT, speech, or other services. Document conflicts on the Notes tab and share with the assigned BCBA so ABA sessions do not overlap.',
    'Calendar'
  ),
  ccStep(
    9,
    'Prepare case for assessment',
    'Before assessment, confirm required clinical documents are received. If a psych eval is missing, coordinate with the in-house psychologist — gather prior reports, IEP, DSM-5, and referrals.',
    'ClipboardList'
  ),
  ccStep(
    10,
    'Coordinate with BCBA / assessment team',
    'Notify the assigned BCBA and Clinical team that the case is assessment-ready. Provide case summary, documents, and family availability from the Schedule tab.',
    'Stethoscope'
  ),
  ccStep(
    11,
    'Track assessment & treatment plan',
    'Monitor assessment completion on the Treatment Plan track and Requirements tab. For NY Medicaid, ensure the treatment plan is completed promptly after assessment.',
    'Activity'
  ),
  ccStep(
    12,
    'Keep parent updated',
    'Send templated updates from the Email tab at major milestones: assessment scheduled, authorization in process, RBT assigned, and start date confirmed.',
    'MessageCircle'
  ),
  ccStep(
    13,
    'Resolve outstanding issues',
    'Address missing information, insurance problems, scheduling conflicts, or delays quickly. Log actions on Notes and Activity.',
    'AlertTriangle'
  ),
  ccStep(
    14,
    'Prepare client for service start',
    'Confirm authorizations, staffing, schedule slots, and documents are complete. Communicate the start date to the family, RBT, and BCBA.',
    'Rocket'
  ),
  ccStep(
    15,
    'Continue coordination after services begin',
    'After go-live, monitor early sessions via schedule and staffing panels. Ensure a smooth first two weeks.',
    'HeartHandshake'
  ),
  ccStep(
    16,
    'Maintain regular contact with RBT and parent',
    'Check in frequently on the Notes tab and by phone/email. Address concerns and document support provided.',
    'Phone'
  ),
  ccStep(
    17,
    'Monitor schedule & coordinate changes',
    'Update session times on the Schedule tab when family or therapist availability changes. Keep weekly hours aligned with authorization.',
    'CalendarClock'
  ),
  ccStep(
    18,
    'Coordinate with staffing on RBT replacement',
    'If an RBT is unavailable, flag replacement on Staffing immediately and open a task for the staffing team.',
    'RefreshCw'
  ),
  ccStep(
    19,
    'Monitor reassessment / reauthorization due dates',
    'Track reassessment and authorization expiration on the Authorization tab and Tasks calendar. Set reminders before deadlines.',
    'Timer'
  ),
  ccStep(
    20,
    'Verify insurance eligibility remains active',
    'Work with Billing to confirm eligibility (VOB) before major authorizations and periodically during active services.',
    'BadgeCheck'
  ),
  ccStep(
    21,
    'Notify admin & BCBA when reassessment is due',
    'Give the BCBA and management enough lead time to plan, schedule, and complete reassessment.',
    'Bell'
  ),
  ccStep(
    22,
    'Coordinate reassessment & reauthorization',
    'Partner with BCBA, psychologist (if needed), and Billing to complete assessments and obtain new treatment authorizations.',
    'GitBranch'
  ),
  ccStep(
    23,
    'Continue cross-department communication',
    'Keep parent, RBT, BCBA, staffing, intake, and billing aligned using Tasks, Notes, and department hand-offs.',
    'Network'
  ),
  ccStep(
    24,
    'Document everything in the CRM',
    'Maintain accurate Notes, upload documents, update requirements, and log emails so the whole team has a single source of truth.',
    'PenLine'
  ),
  ccStep(
    25,
    'Continue monitoring the case',
    'Ongoing: monitor progress, service quality, schedule adherence, and family satisfaction through ACTIVE stage.',
    'Eye'
  ),
  ccStep(
    26,
    'Ensure continuity of care & best outcomes',
    'Stay proactive and organized. Advocate for the client and family throughout their ABA journey at Rise & Shine.',
    'Star'
  ),
]

function roleSteps(
  role: string,
  steps: { title: string; body: string; icon?: string }[]
): TrainingStepSeed[] {
  return steps.map((s, i) => ({
    stepNumber: i + 1,
    slug: `${role}-step-${String(i + 1).padStart(2, '0')}`,
    title: s.title,
    body: s.body,
    icon: s.icon,
  }))
}

export const DEFAULT_CRM_TRAINING_MODULES: TrainingModuleSeed[] = [
  {
    crmRole: 'CASE_COORDINATION',
    title: 'Case Coordinator workflow',
    summary:
      'End-to-end coordination from assignment through active services — Rise & Shine CRM.',
    goalStatement:
      'Ensure a smooth, organized process from intake to ongoing services, with excellent communication and support to families and teams.',
    steps: CASE_COORDINATION_STEPS,
  },
  {
    crmRole: 'INTAKE',
    title: 'Intake responsibilities',
    summary:
      'First contact through document collection and hand-off to clinical/billing. (Starter content — refine as needed.)',
    steps: roleSteps('intake', [
      {
        title: 'Acknowledge new inquiries',
        body: 'Respond promptly to new families. Use CRM communications and move clients from INQUIRY toward INTAKE when contact is made.',
        icon: 'Inbox',
      },
      {
        title: 'Collect & verify intake information',
        body: 'Confirm demographics, insurance, and contact info on the client profile. Upload documents on the Documents tab.',
        icon: 'ClipboardList',
      },
      {
        title: 'Run referral validity checks',
        body: 'For Medicaid and plans requiring referral, complete the referral check panel and ensure physician referral requirements are satisfied.',
        icon: 'FileCheck',
      },
      {
        title: 'Obtain consent & core documents',
        body: 'Guide families through consent (e-sign or upload), insurance card, intake form, and diagnostic materials needed for downstream teams.',
        icon: 'FileSignature',
      },
      {
        title: 'Advance the pipeline',
        body: 'When stage gates are satisfied, advance the client to Benefits or Authorization and hand off to the owning department queue.',
        icon: 'ArrowRight',
      },
      {
        title: 'Keep the pool moving',
        body: 'Monitor unclaimed clients in the Intake queue. Release or escalate stalled cases so families are not left waiting.',
        icon: 'TrendingUp',
      },
    ]),
  },
  {
    crmRole: 'CLINICAL',
    title: 'Clinical / BCBA responsibilities',
    summary:
      'Assessments, treatment plans, and clinical oversight in Rise & Shine CRM. (Starter content — refine as needed.)',
    steps: roleSteps('clinical', [
      {
        title: 'Complete assessments',
        body: 'Conduct Vineland, FAST, and other required assessments. Update Requirements and upload reports on Documents.',
        icon: 'Stethoscope',
      },
      {
        title: 'Treatment plan track',
        body: 'Use the Treatment Plan milestone on the client profile. Complete the plan in parallel with authorization — it is required before ACTIVE.',
        icon: 'FileText',
      },
      {
        title: 'Clinical oversight',
        body: 'Supervise RBT implementation, review session quality, and coordinate with Case Coordination on schedule or staffing issues.',
        icon: 'Eye',
      },
      {
        title: 'Assessment team coordination',
        body: 'Work with CC and psychologist when psych evals or supplemental testing are needed before or during assessment.',
        icon: 'Users',
      },
      {
        title: 'Reassessments on time',
        body: 'Track reassessment due dates on Authorization and Tasks. Complete clinical portions before auth expires.',
        icon: 'Timer',
      },
    ]),
  },
  {
    crmRole: 'AUTHORIZATION',
    title: 'Authorization responsibilities',
    summary:
      'Prior auth submission and tracking. (Starter content — refine as needed.)',
    steps: roleSteps('authorization', [
      {
        title: 'Review clinical package',
        body: 'Confirm assessment, treatment plan, and required documents are complete before submitting authorization.',
        icon: 'FolderCheck',
      },
      {
        title: 'Submit prior authorization',
        body: 'Enter authorization on the Authorization tab with CPT lines, units requested, and payer details.',
        icon: 'Send',
      },
      {
        title: 'Track payer decisions',
        body: 'Update status, denial class, and decision dates. Coordinate appeals with Billing and Clinical when needed.',
        icon: 'Activity',
      },
    ]),
  },
  {
    crmRole: 'BILLING',
    title: 'Billing / Plutus responsibilities',
    summary:
      'VOB, prior auth support, and eligibility monitoring. (Starter content — refine as needed.)',
    steps: roleSteps('billing', [
      {
        title: 'Verify benefits (VOB)',
        body: 'Complete eligibility verification and document VOB on Requirements before treatment authorization.',
        icon: 'BadgeCheck',
      },
      {
        title: 'Support prior authorization',
        body: 'For commercial and non-Medicaid payers, obtain assessment and treatment authorizations with accurate units and CPT codes.',
        icon: 'Shield',
      },
      {
        title: 'Track units approved vs requested',
        body: 'On Authorization lines, record units approved vs requested and flag under-approved authorizations.',
        icon: 'BarChart',
      },
      {
        title: 'Monitor eligibility & expirations',
        body: 'Watch auth expiration dates and periodic eligibility. Alert CC and Clinical before lapses.',
        icon: 'CalendarClock',
      },
    ]),
  },
  {
    crmRole: 'STAFFING',
    title: 'Staffing responsibilities',
    summary:
      'RBT search, assignment, and replacement via Therapist Search and Staffing tab. (Starter content — refine as needed.)',
    steps: roleSteps('staffing', [
      {
        title: 'Therapist Search',
        body: 'Use Therapist Search to find placeable RBTs matching language, borough, gender preference, and availability.',
        icon: 'Search',
      },
      {
        title: 'Assign RBTs',
        body: 'Create BT assignments on the client Staffing tab. Mark primary RBT and track assignment stage.',
        icon: 'UserPlus',
      },
      {
        title: 'Confirm 40-hour training',
        body: 'Verify RBT onboarding and 40-hour certificate in HRM before marking assignment ASSIGNED.',
        icon: 'GraduationCap',
      },
      {
        title: 'Handle replacements',
        body: 'Respond quickly to CC replacement requests. Update assignments and schedule when RBTs change.',
        icon: 'RefreshCw',
      },
      {
        title: 'Schedule alignment',
        body: 'Coordinate with CC on weekly hours vs authorization when building the schedule grid.',
        icon: 'Calendar',
      },
    ]),
  },
  {
    crmRole: 'MANAGEMENT',
    title: 'Management & full-access oversight',
    summary:
      'Oversight across queues, roles, and training completion. (Starter content — refine as needed.)',
    steps: roleSteps('management', [
      {
        title: 'Monitor all department queues',
        body: 'Review Dashboard and department queues for stalled clients, overdue tasks, and auth expirations.',
        icon: 'LayoutDashboard',
      },
      {
        title: 'Role assignment',
        body: 'Use Admin Management to grant/revoke CRM roles. Assign case coordinators via ASSIGNED grants.',
        icon: 'Shield',
      },
      {
        title: 'Training completion',
        body: 'Review staff Profile tabs to see who has completed role training. Follow up on incomplete onboarding.',
        icon: 'CheckCircle',
      },
      {
        title: 'Approvals & escalations',
        body: 'Resolve cross-department blockers, stage overrides, and high-priority staffing or auth issues.',
        icon: 'AlertCircle',
      },
    ]),
  },
]
