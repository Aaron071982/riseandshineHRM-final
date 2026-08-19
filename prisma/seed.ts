/**
 * Synthetic (non-PHI) seed for the riseandshine-hrm-dev Supabase project.
 *
 * ALL personal data is faker-generated with @example.com emails.
 * Never import Artemis exports, rosters, or /uploads.
 * Safe to re-run: clears prior SYNTH- / @example.com rows, then re-inserts.
 */
import { faker } from '@faker-js/faker'
import {
  PrismaClient,
  type AuthStatus,
  type ClientOwnerDept,
  type ClientPipelineStatus,
  type ClientReferralSource,
  type ClientStage,
  type CommTemplate,
  type OnboardingDocumentType,
  type RequirementStatus,
  type RequirementType,
  type RBTStatus,
  type ServiceClientDocumentType,
  type ServiceClientStatus,
} from '@prisma/client'
import { assertWriteTarget } from './seed-guard'
import {
  REQUIREMENT_KEY_LABELS,
  STAGE_DEFAULT_OWNER_DEPT,
  STAGE_GATE_REQUIREMENT_KEYS,
} from '../lib/crm/stages'
import { CANONICAL_DOCUMENTS, isDocumentRequired } from '../lib/crm/documents'

faker.seed(20260813)

const prisma = new PrismaClient()

const DOC_TYPES: ServiceClientDocumentType[] = [
  'INSURANCE_CARD',
  'MEDICAID_CARD',
  'DIAGNOSTIC_EVAL',
  'PHYSICIAN_REFERRAL',
  'IEP_IFSP',
  'CUSTODY_GUARDIAN',
  'PRIOR_ABA_RECORDS',
  'CONSENT_FORM',
  'MEET_AND_GREET_FORM',
]

const BOROUGHS = ['Bronx', 'Brooklyn', 'Queens', 'Manhattan', 'Staten Island'] as const

const ONBOARDING_CATALOG: {
  title: string
  slug: string
  type: OnboardingDocumentType
  stepNumber: number
}[] = [
  { title: 'Handbook', slug: 'handbook', type: 'ACKNOWLEDGMENT', stepNumber: 1 },
  { title: 'HIPAA', slug: 'hipaa', type: 'ACKNOWLEDGMENT', stepNumber: 2 },
  { title: 'Mandated Reporter', slug: 'mandated-reporter', type: 'ACKNOWLEDGMENT', stepNumber: 3 },
  { title: 'NDA', slug: 'nda', type: 'ACKNOWLEDGMENT', stepNumber: 4 },
  { title: 'Emergency Policy', slug: 'emergency-policy', type: 'ACKNOWLEDGMENT', stepNumber: 5 },
  {
    title: 'Background Check Authorization',
    slug: 'background-check-authorization',
    type: 'FILLABLE_PDF',
    stepNumber: 6,
  },
  { title: 'I-9', slug: 'i9', type: 'FILLABLE_PDF', stepNumber: 7 },
  { title: 'W-4', slug: 'w4', type: 'FILLABLE_PDF', stepNumber: 8 },
  {
    title: 'Direct Deposit Authorization',
    slug: 'direct-deposit-authorization',
    type: 'FILLABLE_PDF',
    stepNumber: 9,
  },
]

function synthEmail(local: string) {
  return `${local.replace(/[^a-z0-9._-]/gi, '').toLowerCase()}@example.com`
}

function periodBounds() {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)) // Monday
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 13)
  return { start, end }
}

async function clearSynthetic() {
  console.log('→ Clearing prior synthetic rows…')

  const synthUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@example.com' } },
    select: { id: true },
  })
  const userIds = synthUsers.map((u) => u.id)

  await prisma.rbtScheduleAssignment.deleteMany({
    where: {
      OR: [
        { notes: { contains: '[SYNTHETIC]' } },
        ...(userIds.length ? [{ createdBy: { in: userIds } }] : []),
      ],
    },
  })

  await prisma.serviceClient.deleteMany({
    where: {
      OR: [{ clientCode: { startsWith: 'SYNTH-' } }, { notes: { contains: '[SYNTHETIC]' } }],
    },
  })

  await prisma.trainingSession.deleteMany({
    where: {
      OR: [
        { notes: { contains: '[SYNTHETIC]' } },
        ...(userIds.length ? [{ hostUserId: { in: userIds } }] : []),
      ],
    },
  })

  await prisma.bCBAProfile.deleteMany({
    where: { OR: [{ email: { endsWith: '@example.com' } }, { notes: { contains: '[SYNTHETIC]' } }] },
  })

  await prisma.candidateApplicationDraft.deleteMany({
    where: { email: { endsWith: '@example.com' } },
  })

  // OrgNode parent FK is Restrict — delete leaves before roots
  await prisma.orgNode.deleteMany({
    where: {
      AND: [
        { parentId: { not: null } },
        { OR: [{ email: { endsWith: '@example.com' } }, { name: { startsWith: 'Synth ' } }] },
      ],
    },
  })
  await prisma.orgNode.deleteMany({
    where: {
      OR: [{ email: { endsWith: '@example.com' } }, { name: { startsWith: 'Synth ' } }],
    },
  })

  await prisma.companySetting.deleteMany({
    where: {
      key: {
        in: ['client_services_schedule_period', 'client_services_hours_gap_threshold'],
      },
    },
  })

  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }

  console.log(`  cleared ${userIds.length} @example.com users + related rows`)
}

async function main() {
  const target = assertWriteTarget({ allowProd: false })
  if (target.dryRun) {
    console.log('Dry run — would clear SYNTH- / @example.com rows and re-seed.')
    console.log('Pass --confirm to write (prisma db seed already does).')
    return
  }
  console.log('🌱 Synthetic seed starting (PHI-free)…')

  await clearSynthetic()

  const { start: periodStart, end: periodEnd } = periodBounds()
  const periodValue = {
    start: periodStart.toISOString().slice(0, 10),
    end: periodEnd.toISOString().slice(0, 10),
  }

  await prisma.companySetting.create({
    data: { key: 'client_services_schedule_period', value: periodValue },
  })
  await prisma.companySetting.create({
    data: { key: 'client_services_hours_gap_threshold', value: 2 },
  })

  // --- Admin / CS access user ---
  const admin = await prisma.user.create({
    data: {
      name: 'Dev Admin',
      email: 'admin@example.com',
      phoneNumber: '5550100001',
      role: 'ADMIN',
      isActive: true,
    },
  })

  const { PHASE17_ROLE_TEST_USERS } = await import('../lib/crm/phase17TestUsers')
  for (const u of PHASE17_ROLE_TEST_USERS) {
    const row = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        role: 'ADMIN',
        isActive: true,
      },
    })
    await prisma.userCrmRole.create({
      data: { userId: row.id, role: u.crmRole, grantedByUserId: admin.id },
    })
  }

  const bcbaUser = await prisma.user.create({
    data: {
      name: 'Synth BCBA',
      email: 'bcba@example.com',
      phoneNumber: '5550100002',
      role: 'BCBA',
      isActive: true,
    },
  })

  const bcbaProfile = await prisma.bCBAProfile.create({
    data: {
      fullName: 'Synth BCBA Supervisor',
      email: 'bcba@example.com',
      phone: '5550100002',
      isSupervisor: true,
      status: 'Active',
      notes: '[SYNTHETIC] seed BCBA',
    },
  })

  // --- Org chart ---
  const orgRoot = await prisma.orgNode.create({
    data: {
      name: 'Synth Rise & Shine',
      title: 'Agency',
      department: 'Leadership',
      email: 'org-root@example.com',
      linkedUserId: admin.id,
      sortOrder: 0,
    },
  })
  await prisma.orgNode.create({
    data: {
      parentId: orgRoot.id,
      name: 'Synth Clinical',
      title: 'Clinical Director',
      department: 'Clinical',
      email: 'org-clinical@example.com',
      linkedUserId: bcbaUser.id,
      sortOrder: 1,
    },
  })
  await prisma.orgNode.create({
    data: {
      parentId: orgRoot.id,
      name: 'Synth Operations',
      title: 'Ops Lead',
      department: 'Operations',
      email: 'org-ops@example.com',
      sortOrder: 2,
    },
  })

  // --- Onboarding catalog ---
  for (const doc of ONBOARDING_CATALOG) {
    await prisma.onboardingDocument.upsert({
      where: { slug: doc.slug },
      update: {
        title: doc.title,
        type: doc.type,
        stepNumber: doc.stepNumber,
        sortOrder: doc.stepNumber,
        displayOrder: doc.stepNumber,
        isActive: true,
      },
      create: {
        title: doc.title,
        slug: doc.slug,
        type: doc.type,
        stepNumber: doc.stepNumber,
        sortOrder: doc.stepNumber,
        displayOrder: doc.stepNumber,
        isActive: true,
      },
    })
  }
  const onboardingDocs = await prisma.onboardingDocument.findMany({
    where: { slug: { in: ONBOARDING_CATALOG.map((d) => d.slug) } },
  })

  // --- Training session ---
  const sessionStart = new Date()
  sessionStart.setUTCDate(sessionStart.getUTCDate() + 3)
  sessionStart.setUTCHours(15, 0, 0, 0)
  const sessionEnd = new Date(sessionStart)
  sessionEnd.setUTCHours(16, 0, 0, 0)

  const training = await prisma.trainingSession.create({
    data: {
      hostUserId: admin.id,
      title: 'Synth Artemis Training',
      description: '[SYNTHETIC] seed training',
      sessionDate: sessionStart,
      startTime: sessionStart,
      endTime: sessionEnd,
      meetingUrl: 'https://example.com/meet/synth-artemis',
      maxAttendees: 12,
      status: 'SCHEDULED',
      notes: '[SYNTHETIC]',
    },
  })

  // --- BTs (~20) + a few supervisors ---
  const btStatuses: RBTStatus[] = [
    'HIRED',
    'ONBOARDING_COMPLETED',
    'ONBOARDING_COMPLETED',
    'HIRED',
    'INTERVIEW_SCHEDULED',
    'TO_INTERVIEW',
    'NEW',
  ]

  type BtSeed = {
    userId: string
    rbtId: string
    firstName: string
    lastName: string
    displayName: string
  }
  const bts: BtSeed[] = []
  const rbtSeedLocations = [
    {
      address: '20 Jay St',
      city: 'Brooklyn',
      zip: '11201',
      latitude: 40.7043,
      longitude: -73.9866,
    },
    {
      address: '30-30 Thomson Ave',
      city: 'Long Island City',
      zip: '11101',
      latitude: 40.744,
      longitude: -73.9357,
    },
    {
      address: '1200 Waters Pl',
      city: 'Bronx',
      zip: '10461',
      latitude: 40.8526,
      longitude: -73.8377,
    },
    {
      address: '90-15 Queens Blvd',
      city: 'Elmhurst',
      zip: '11373',
      latitude: 40.7346,
      longitude: -73.8697,
    },
  ] as const

  for (let i = 0; i < 20; i++) {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const email = synthEmail(`bt.${firstName}.${lastName}.${i}`)
    const phone = `55501${String(10000 + i).slice(-5)}`
    const status = btStatuses[i % btStatuses.length]
    const isSupervisorish = i < 3
    const seedLocation = rbtSeedLocations[i % rbtSeedLocations.length]

    const user = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phoneNumber: phone,
        role: isSupervisorish ? 'BCBA' : 'RBT',
        isActive: true,
      },
    })

    const rbt = await prisma.rBTProfile.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        phoneNumber: phone,
        email,
        addressLine1: seedLocation.address,
        locationCity: seedLocation.city,
        locationState: 'NY',
        zipCode: seedLocation.zip,
        latitude: seedLocation.latitude,
        longitude: seedLocation.longitude,
        gender: i % 2 === 0 ? 'Male' : 'Female',
        status,
        fortyHourCourseCompleted: i % 3 !== 0,
        scheduleCompleted: i % 2 === 0,
        source: 'ADMIN_CREATED',
        postHireStage: status === 'ONBOARDING_COMPLETED' ? 'ACTIVE_DELIVERY' : 'MATCHING',
        hourlyPayRate: 20 + (i % 5),
        artemisProviderName: `${lastName}, ${firstName}`,
        payrollName: `${lastName}, ${firstName}`,
        notes: '[SYNTHETIC] seed BT',
        ethnicity: i % 2 === 0 ? 'SOUTH_ASIAN' : 'HISPANIC',
      },
    })

    const displayName = `${firstName} ${lastName}`
    bts.push({
      userId: user.id,
      rbtId: rbt.id,
      firstName,
      lastName,
      displayName,
    })

    // Onboarding tasks + completions with varied progress
    const completedCount = i % 10 // 0..9 of 9 docs
    for (let idx = 0; idx < onboardingDocs.length; idx++) {
      const doc = onboardingDocs[idx]
      const done = idx < completedCount
      await prisma.onboardingCompletion.create({
        data: {
          rbtProfileId: rbt.id,
          documentId: doc.id,
          status: done ? 'COMPLETED' : idx === completedCount ? 'IN_PROGRESS' : 'NOT_STARTED',
          completedAt: done ? faker.date.recent({ days: 30 }) : null,
        },
      })
    }

    await prisma.onboardingTask.create({
      data: {
        rbtProfileId: rbt.id,
        taskType: 'DOWNLOAD_DOC',
        title: 'Download handbook packet',
        isCompleted: completedCount > 0,
        sortOrder: 1,
      },
    })

    await prisma.employeeDocumentFolder.create({
      data: {
        rbtProfileId: rbt.id,
        folderType: 'PERSONAL_DOCUMENTS',
        fileUrl: 'https://example.com/synth/placeholder.pdf',
        fileName: `synth-${i}-id.pdf`,
      },
    })

    if (i % 4 === 0) {
      await prisma.trainingBooking.create({
        data: {
          trainingSessionId: training.id,
          rbtProfileId: rbt.id,
          attendanceStatus: 'BOOKED',
        },
      })
    }

    if (status === 'INTERVIEW_SCHEDULED' || status === 'TO_INTERVIEW' || i < 4) {
      const when = faker.date.soon({ days: 14 })
      await prisma.interview.create({
        data: {
          rbtProfileId: rbt.id,
          scheduledAt: when,
          durationMinutes: 30,
          interviewerName: 'Dev Admin',
          status: status === 'INTERVIEW_SCHEDULED' ? 'SCHEDULED' : i % 2 === 0 ? 'COMPLETED' : 'SCHEDULED',
          decision: 'PENDING',
          claimedByUserId: admin.id,
        },
      })
    }

    if (i % 5 === 0) {
      const clockIn = faker.date.recent({ days: 5 })
      const clockOut = new Date(clockIn.getTime() + 3 * 60 * 60 * 1000)
      await prisma.timeEntry.create({
        data: {
          rbtProfileId: rbt.id,
          clockInTime: clockIn,
          clockOutTime: clockOut,
          totalHours: 3,
          source: 'WEB_MANUAL',
          notes: '[SYNTHETIC] clock entry',
        },
      })
    }
  }

  // A few candidate users (pipeline only)
  for (let i = 0; i < 4; i++) {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const email = synthEmail(`candidate.${firstName}.${lastName}.${i}`)
    const user = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phoneNumber: `55502${String(10000 + i).slice(-5)}`,
        role: 'CANDIDATE',
        isActive: true,
      },
    })
    await prisma.rBTProfile.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        phoneNumber: user.phoneNumber!,
        email,
        status: 'NEW',
        notes: '[SYNTHETIC] candidate',
      },
    })
    await prisma.candidateApplicationDraft.create({
      data: {
        email,
        token: `synth-draft-${i}-${faker.string.alphanumeric(12)}`,
        status: 'IN_PROGRESS',
        dataJson: { firstName, lastName, synthetic: true },
      },
    })
  }

  // --- Clients (~22) across CRM stages ---
  type ClientPlan = {
    code: string
    stage: ClientStage
    pipelineStatus: ClientPipelineStatus
    /** legacy status column (deprecated) */
    status: ServiceClientStatus
    withBt: boolean
    assignmentStage?: 'SEARCHING' | 'CONTACTED' | 'INTERESTED' | 'MATCH_PENDING' | 'ASSIGNED'
    scheduleLinked: boolean
    scheduleOrphanName?: string
    docsCollected: number
    authHours: number
    weeklyHoursTarget: number
    authExpirationDays?: number | null
    alert?: 'RBT_REPLACEMENT_NEEDED' | 'AUTH_EXPIRING' | 'UNCONTACTED_INQUIRY'
    referralSource?: ClientReferralSource
  }

  const plans: ClientPlan[] = [
    // Early funnel
    {
      code: 'SYNTH-IQ-1',
      stage: 'INQUIRY',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 0,
      authHours: 0,
      weeklyHoursTarget: 0,
      alert: 'UNCONTACTED_INQUIRY',
      referralSource: 'PHONE',
    },
    {
      code: 'SYNTH-IQ-2',
      stage: 'INQUIRY',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 0,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'WEBSITE',
    },
    {
      code: 'SYNTH-IT-1',
      stage: 'INTAKE',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 1,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'REFERRAL',
    },
    {
      code: 'SYNTH-IT-2',
      stage: 'INTAKE',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 2,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'EMAIL',
    },
    {
      code: 'SYNTH-CN-1',
      stage: 'CONSENT',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 2,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'PROVIDER',
    },
    {
      code: 'SYNTH-DC-1',
      stage: 'DOCUMENTS',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 3,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'COMMUNITY',
    },
    {
      code: 'SYNTH-DC-2',
      stage: 'DOCUMENTS',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 4,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'SOCIAL_MEDIA',
    },
    // Clinical / auth
    {
      code: 'SYNTH-BF-1',
      stage: 'BENEFITS',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 6,
      authHours: 12,
      weeklyHoursTarget: 0,
      referralSource: 'PHONE',
    },
    {
      code: 'SYNTH-AS-1',
      stage: 'ASSESSMENT',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 7,
      authHours: 12,
      weeklyHoursTarget: 0,
      authExpirationDays: 60,
    },
    {
      code: 'SYNTH-TP-1',
      stage: 'TREATMENT_PLAN',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 8,
      authHours: 15,
      weeklyHoursTarget: 0,
      authExpirationDays: 45,
    },
    {
      code: 'SYNTH-AU-1',
      stage: 'AUTHORIZATION',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 8,
      authHours: 18,
      weeklyHoursTarget: 0,
      authExpirationDays: 30,
      alert: 'AUTH_EXPIRING',
    },
    {
      code: 'SYNTH-AP-1',
      stage: 'APPROVED',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 9,
      authHours: 20,
      weeklyHoursTarget: 0,
      authExpirationDays: 90,
    },
    // Staffing
    {
      code: 'SYNTH-RS-1',
      stage: 'READY_FOR_STAFFING',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 9,
      authHours: 20,
      weeklyHoursTarget: 0,
      authExpirationDays: 120,
    },
    {
      code: 'SYNTH-RB-1',
      stage: 'RBT_SEARCH',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: true,
      assignmentStage: 'SEARCHING',
      scheduleLinked: false,
      docsCollected: 9,
      authHours: 18,
      weeklyHoursTarget: 0,
      authExpirationDays: 100,
    },
    {
      code: 'SYNTH-RA-1',
      stage: 'RBT_ASSIGNED',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: false,
      docsCollected: 9,
      authHours: 16,
      weeklyHoursTarget: 0,
      authExpirationDays: 80,
    },
    {
      code: 'SYNTH-SC-1',
      stage: 'SCHEDULE_COORDINATION',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: true,
      docsCollected: 9,
      authHours: 15,
      weeklyHoursTarget: 8,
      authExpirationDays: 70,
    },
    {
      code: 'SYNTH-SF-1',
      stage: 'SCHEDULE_CONFIRMED',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: true,
      docsCollected: 9,
      authHours: 15,
      weeklyHoursTarget: 10,
      authExpirationDays: 55,
    },
    {
      code: 'SYNTH-PS-1',
      stage: 'PRE_START',
      pipelineStatus: 'LIVE',
      status: 'NEW',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: true,
      docsCollected: 9,
      authHours: 14,
      weeklyHoursTarget: 12,
      authExpirationDays: 40,
    },
    // Active cluster
    {
      code: 'SYNTH-AC-1',
      stage: 'ACTIVE',
      pipelineStatus: 'LIVE',
      status: 'ACTIVE',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: true,
      docsCollected: 9,
      authHours: 20,
      weeklyHoursTarget: 12,
      authExpirationDays: 15,
      alert: 'AUTH_EXPIRING',
    },
    {
      code: 'SYNTH-AC-2',
      stage: 'ACTIVE',
      pipelineStatus: 'LIVE',
      status: 'ACTIVE',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: true,
      docsCollected: 9,
      authHours: 18,
      weeklyHoursTarget: 10,
      authExpirationDays: 7,
      alert: 'RBT_REPLACEMENT_NEEDED',
    },
    {
      code: 'SYNTH-OH-1',
      stage: 'ACTIVE',
      pipelineStatus: 'ON_HOLD',
      status: 'ON_HOLD',
      withBt: true,
      assignmentStage: 'ASSIGNED',
      scheduleLinked: false,
      docsCollected: 9,
      authHours: 10,
      weeklyHoursTarget: 0,
      authExpirationDays: 30,
    },
    {
      code: 'SYNTH-OH-2',
      stage: 'ACTIVE',
      pipelineStatus: 'ON_HOLD',
      status: 'ON_HOLD',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 5,
      authHours: 8,
      weeklyHoursTarget: 0,
      authExpirationDays: 20,
    },
    // Closed
    {
      code: 'SYNTH-DI-1',
      stage: 'ACTIVE',
      pipelineStatus: 'DISCHARGED',
      status: 'DISCHARGED',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 9,
      authHours: 0,
      weeklyHoursTarget: 0,
      authExpirationDays: null,
    },
    {
      code: 'SYNTH-LO-1',
      stage: 'INTAKE',
      pipelineStatus: 'LOST',
      status: 'DISCHARGED',
      withBt: false,
      scheduleLinked: false,
      docsCollected: 1,
      authHours: 0,
      weeklyHoursTarget: 0,
      referralSource: 'OTHER',
    },
  ]

  const activeBts = bts.filter((_, i) => i >= 3)
  const clientSeedAddresses = [
    {
      address: '1 Metrotech Center',
      city: 'Brooklyn',
      borough: 'Brooklyn',
      zip: '11201',
    },
    {
      address: '37-18 Northern Blvd',
      city: 'Long Island City',
      borough: 'Queens',
      zip: '11101',
    },
    {
      address: '1776 Eastchester Rd',
      city: 'Bronx',
      borough: 'Bronx',
      zip: '10461',
    },
  ] as const

  function daysFromNow(days: number) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + days)
    return d
  }

  function requirementStatusesForStage(
    stage: ClientStage,
    keys: readonly string[]
  ): { key: string; status: RequirementStatus; type: RequirementType }[] {
    return keys.map((key, i) => {
      let status: RequirementStatus = 'PENDING'
      // Prior stages mostly complete; current stage mixed
      if (i === 0) status = 'COMPLETE'
      else if (i === 1) status = faker.helpers.arrayElement(['PENDING', 'RECEIVED', 'MISSING'] as const)
      else status = faker.helpers.arrayElement(['PENDING', 'COMPLETE', 'RECEIVED'] as const)

      const type: RequirementType =
        key.includes('card') ||
        key.includes('eval') ||
        key.includes('referral') ||
        key.includes('form') ||
        key.includes('packet')
          ? 'DOCUMENT'
          : key.includes('scheduled') || key.includes('contacted') || key.includes('sent')
            ? 'TASK'
            : 'FIELD'

      return { key, status, type }
    })
  }

  const stageCommTemplate: Partial<Record<ClientStage, CommTemplate>> = {
    INQUIRY: 'INQUIRY_ACK',
    CONSENT: 'CONSENT_REQUEST',
    DOCUMENTS: 'DOCS_NEEDED',
    BENEFITS: 'BENEFITS_UPDATE',
    ASSESSMENT: 'ASSESSMENT_SCHEDULED',
    APPROVED: 'AUTH_APPROVED',
    READY_FOR_STAFFING: 'READY_FOR_STAFFING',
    RBT_ASSIGNED: 'RBT_ASSIGNED',
    SCHEDULE_CONFIRMED: 'SCHEDULE_CONFIRMED',
    ACTIVE: 'SERVICES_STARTED',
  }

  for (let idx = 0; idx < plans.length; idx++) {
    const plan = plans[idx]
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const bt = activeBts[idx % activeBts.length]
    const borough = faker.helpers.arrayElement(BOROUGHS)
    const seedAddress = clientSeedAddresses[idx % clientSeedAddresses.length]
    const ownerDept: ClientOwnerDept = STAGE_DEFAULT_OWNER_DEPT[plan.stage]
    const stageEnteredAt = faker.date.recent({ days: 14 })
    const nextActionDueAt = daysFromNow(faker.number.int({ min: -3, max: 10 }))

    const client = await prisma.serviceClient.create({
      data: {
        clientCode: plan.code,
        firstName,
        lastName,
        status: plan.status,
        stage: plan.stage,
        pipelineStatus: plan.pipelineStatus,
        stageEnteredAt,
        currentOwnerDept: ownerDept,
        currentOwnerUserId: admin.id,
        caseCoordinatorUserId: admin.id,
        bcbaProfileId: bcbaProfile.id,
        nextAction: `Advance ${plan.stage.replace(/_/g, ' ').toLowerCase()} checklist`,
        nextActionDueAt,
        referralSource: plan.referralSource ?? 'PHONE',
        inquiryReceivedAt: faker.date.past({ years: 1 }),
        lastParentContactAt:
          plan.alert === 'UNCONTACTED_INQUIRY' ? null : faker.date.recent({ days: 20 }),
        actualServiceStartDate: plan.stage === 'ACTIVE' && plan.pipelineStatus === 'LIVE'
          ? faker.date.past({ years: 1 })
          : null,
        dateOfBirth: faker.date.birthdate({ min: 3, max: 12, mode: 'age' }),
        addressLine: seedAddress.address,
        city: seedAddress.city,
        borough: seedAddress.borough,
        state: 'NY',
        zip: seedAddress.zip,
        preferredRbtGender:
          idx % 3 === 0 ? 'MALE' : idx % 3 === 1 ? 'FEMALE' : 'ANY',
        preferredRbtEthnicities:
          idx % 3 === 0
            ? ['SOUTH_ASIAN']
            : idx % 3 === 1
              ? ['HISPANIC', 'BLACK']
              : [],
        insuranceProvider: faker.helpers.arrayElement(['Fidelis', 'Healthfirst', 'MetroPlus']),
        insuranceId: `SYNTH-${faker.string.alphanumeric(8).toUpperCase()}`,
        diagnosis: 'F84.0',
        parentName: `${faker.person.firstName()} ${lastName}`,
        parentPhone: `55503${String(10000 + idx).slice(-5)}`,
        parentEmail: synthEmail(`parent.${plan.code.toLowerCase()}`),
        parentRelationship: 'Parent',
        bcbaName: 'Synth BCBA Supervisor',
        caseCoordinatorName: 'Dev Admin',
        serviceStartDate:
          plan.stage === 'ACTIVE' || plan.stage === 'PRE_START'
            ? faker.date.past({ years: 1 })
            : null,
        authLengthMonths: 6,
        authHours: plan.authHours,
        currentHoursPerWeek: plan.weeklyHoursTarget || null,
        notes: '[SYNTHETIC] seed client',
        createdBy: admin.id,
      },
    })

    // Requirements for current stage (mixed statuses)
    const gateKeys = STAGE_GATE_REQUIREMENT_KEYS[plan.stage]
    const reqRows = requirementStatusesForStage(plan.stage, gateKeys)
    for (const req of reqRows) {
      const catalog = CANONICAL_DOCUMENTS.find((d) => d.key === req.key)
      const done = req.status === 'COMPLETE' || req.status === 'RECEIVED'
      await prisma.clientRequirement.create({
        data: {
          serviceClientId: client.id,
          stage: catalog?.stage ?? plan.stage,
          key: req.key,
          label: catalog?.label ?? REQUIREMENT_KEY_LABELS[req.key] ?? req.key,
          type: catalog?.type ?? req.type,
          group: catalog?.group ?? 'STAGE',
          status: req.status,
          isRequiredToAdvance: catalog
            ? isDocumentRequired(catalog, client.insuranceProvider)
            : true,
          completedAt: done ? faker.date.recent({ days: 30 }) : null,
          completedByUserId: done ? admin.id : null,
          notes: '[SYNTHETIC] gate requirement',
        },
      })
    }

    const existingKeys = new Set(reqRows.map((r) => r.key))
    for (const doc of CANONICAL_DOCUMENTS) {
      if (existingKeys.has(doc.key)) continue
      await prisma.clientRequirement.create({
        data: {
          serviceClientId: client.id,
          stage: doc.stage,
          key: doc.key,
          label: doc.label,
          type: doc.type,
          group: doc.group,
          status: 'PENDING',
          isRequiredToAdvance: isDocumentRequired(doc, client.insuranceProvider),
          notes: '[SYNTHETIC] canonical document',
        },
      })
    }

    // Authorizations for approved/staffing/active stages
    const needsAuth =
      plan.authExpirationDays != null ||
      [
        'ASSESSMENT',
        'TREATMENT_PLAN',
        'AUTHORIZATION',
        'APPROVED',
        'READY_FOR_STAFFING',
        'RBT_SEARCH',
        'RBT_ASSIGNED',
        'SCHEDULE_COORDINATION',
        'SCHEDULE_CONFIRMED',
        'PRE_START',
        'ACTIVE',
      ].includes(plan.stage)

    if (needsAuth && plan.authHours > 0) {
      const expDays = plan.authExpirationDays ?? 90
      const authStatus: AuthStatus =
        plan.stage === 'AUTHORIZATION'
          ? 'PENDING'
          : plan.stage === 'ASSESSMENT' || plan.stage === 'TREATMENT_PLAN'
            ? 'REQUESTED'
            : 'APPROVED'
      const auth = await prisma.clientAuthorization.create({
        data: {
          serviceClientId: client.id,
          authType: plan.stage === 'ASSESSMENT' ? 'ASSESSMENT' : 'TREATMENT',
          payerName: client.insuranceProvider ?? 'Fidelis',
          authNumber: `SYNTH-AUTH-${plan.code}`,
          status: authStatus,
          requestedAt: faker.date.past({ years: 1 }),
          approvedAt: authStatus === 'APPROVED' ? faker.date.past({ years: 1 }) : null,
          effectiveDate: authStatus === 'APPROVED' ? faker.date.past({ years: 1 }) : null,
          expirationDate: daysFromNow(expDays),
          renderingProvider: 'Synth BCBA Supervisor',
          notes: '[SYNTHETIC] authorization',
        },
      })
      await prisma.clientAuthorizationLine.createMany({
        data: [
          {
            authorizationId: auth.id,
            cptCode: '97153',
            unitsAuthorized: Math.max(100, Math.round(plan.authHours * 4 * 26)),
            unitsUsed: Math.round(plan.authHours * 4 * 4),
            description: 'Adaptive behavior treatment by protocol',
          },
          {
            authorizationId: auth.id,
            cptCode: '97155',
            unitsAuthorized: 48,
            unitsUsed: 8,
            description: 'Adaptive behavior treatment with protocol modification',
          },
        ],
      })
    }

    // Tasks: one open + one overdue for live clients
    if (plan.pipelineStatus === 'LIVE') {
      await prisma.clientTask.create({
        data: {
          serviceClientId: client.id,
          title: `Follow up — ${plan.stage}`,
          description: '[SYNTHETIC] open task',
          ownerDept,
          assignedToUserId: admin.id,
          dueAt: daysFromNow(5),
          status: 'OPEN',
          createdByUserId: admin.id,
        },
      })
      await prisma.clientTask.create({
        data: {
          serviceClientId: client.id,
          title: 'Overdue checklist item',
          description: '[SYNTHETIC] overdue task',
          ownerDept,
          assignedToUserId: admin.id,
          dueAt: daysFromNow(-4),
          status: 'OPEN',
          createdByUserId: admin.id,
        },
      })
    }

    // Communications
    const template = stageCommTemplate[plan.stage] ?? 'MANUAL'
    await prisma.clientCommunication.create({
      data: {
        serviceClientId: client.id,
        template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: `[SYNTHETIC] ${template}`,
        body: `Synthetic outreach for ${plan.code}`,
        sentByUserId: admin.id,
        status: 'SENT',
      },
    })
    if (idx % 3 === 0) {
      await prisma.clientCommunication.create({
        data: {
          serviceClientId: client.id,
          template: 'MANUAL',
          channel: 'PHONE',
          direction: 'INBOUND',
          subject: null,
          body: '[SYNTHETIC] parent called back',
          sentByUserId: admin.id,
          status: 'LOGGED',
        },
      })
    }

    if (plan.alert) {
      await prisma.clientAlert.create({
        data: {
          serviceClientId: client.id,
          alertType: plan.alert,
          severity: plan.alert === 'RBT_REPLACEMENT_NEEDED' ? 'URGENT' : 'WARNING',
          message: `[SYNTHETIC] ${plan.alert.replace(/_/g, ' ').toLowerCase()}`,
          dueAt: daysFromNow(3),
        },
      })
    }

    if (plan.withBt) {
      await prisma.serviceClientBtAssignment.create({
        data: {
          serviceClientId: client.id,
          btName: bt.displayName,
          rbtProfileId: bt.rbtId,
          assignmentStage: plan.assignmentStage ?? 'ASSIGNED',
          isPrimary: true,
          status: 'ACTIVE',
        },
      })
    }

    const collected = Math.min(plan.docsCollected, DOC_TYPES.length)
    for (let dIdx = 0; dIdx < DOC_TYPES.length; dIdx++) {
      const documentType = DOC_TYPES[dIdx]
      const isCollected = dIdx < collected
      await prisma.serviceClientDocument.create({
        data: {
          serviceClientId: client.id,
          documentType,
          collected: isCollected,
          collectedAt: isCollected ? faker.date.recent({ days: 60 }) : null,
          collectedBy: isCollected ? admin.id : null,
          notes: isCollected ? '[SYNTHETIC] collected' : null,
        },
      })
    }

    if (plan.scheduleLinked && plan.weeklyHoursTarget > 0) {
      const slotsNeeded = Math.max(2, Math.min(4, Math.ceil(plan.weeklyHoursTarget / 3)))
      const hoursPer = plan.weeklyHoursTarget / slotsNeeded
      for (let s = 0; s < slotsNeeded; s++) {
        const dayOfWeek = 1 + ((idx + s) % 5)
        const startHour = 9 + s
        const endHour = startHour + Math.max(1, Math.round(hoursPer))
        await prisma.rbtScheduleAssignment.create({
          data: {
            rbtProfileId: bt.rbtId,
            clientName: `${firstName} ${lastName}`,
            dayOfWeek,
            startTime: `${String(startHour).padStart(2, '0')}:00`,
            endTime: `${String(Math.min(endHour, 18)).padStart(2, '0')}:00`,
            location: 'Home',
            clientBorough: borough,
            isActive: true,
            source: 'MANUAL',
            periodStart,
            periodEnd,
            serviceClientId: client.id,
            serviceClientLinkManual: true,
            createdBy: admin.id,
            notes: '[SYNTHETIC] linked schedule',
          },
        })
      }
    }

    if (plan.scheduleOrphanName) {
      await prisma.rbtScheduleAssignment.create({
        data: {
          rbtProfileId: bt.rbtId,
          clientName: plan.scheduleOrphanName,
          dayOfWeek: 2,
          startTime: '10:00',
          endTime: '13:00',
          location: 'Home',
          clientBorough: borough,
          isActive: true,
          source: 'MANUAL',
          periodStart,
          periodEnd,
          serviceClientId: null,
          serviceClientLinkManual: false,
          createdBy: admin.id,
          notes: '[SYNTHETIC] unmatched orphan schedule name',
        },
      })
    }
  }

  // Extra unmatched schedule-only names (no ServiceClient at all)
  for (const name of ['Unmatched Gamma', 'Unmatched Delta']) {
    await prisma.rbtScheduleAssignment.create({
      data: {
        rbtProfileId: bts[5].rbtId,
        clientName: name,
        dayOfWeek: 3,
        startTime: '11:00',
        endTime: '14:00',
        isActive: true,
        source: 'MANUAL',
        periodStart,
        periodEnd,
        createdBy: admin.id,
        notes: '[SYNTHETIC] unmatched schedule-only',
      },
    })
  }

  const counts = {
    users: await prisma.user.count({ where: { email: { endsWith: '@example.com' } } }),
    rbtProfiles: await prisma.rBTProfile.count({ where: { notes: { contains: '[SYNTHETIC]' } } }),
    serviceClients: await prisma.serviceClient.count({
      where: { clientCode: { startsWith: 'SYNTH-' } },
    }),
    clientRequirements: await prisma.clientRequirement.count({
      where: { notes: { contains: '[SYNTHETIC]' } },
    }),
    clientAuthorizations: await prisma.clientAuthorization.count({
      where: { notes: { contains: '[SYNTHETIC]' } },
    }),
    clientTasks: await prisma.clientTask.count({
      where: { description: { contains: '[SYNTHETIC]' } },
    }),
    scheduleAssignments: await prisma.rbtScheduleAssignment.count({
      where: { notes: { contains: '[SYNTHETIC]' } },
    }),
    onboardingDocuments: onboardingDocs.length,
    interviews: await prisma.interview.count(),
    trainingSessions: await prisma.trainingSession.count({
      where: { notes: { contains: '[SYNTHETIC]' } },
    }),
    orgNodes: await prisma.orgNode.count({ where: { email: { endsWith: '@example.com' } } }),
  }

  console.log('🎉 Synthetic seed complete')
  console.table(counts)

  const { bootstrapCrmSuperAdmins } = await import('@/lib/crm/bootstrapRoles')
  const boot = await bootstrapCrmSuperAdmins(admin.id)
  console.log('[crm-bootstrap]', boot)

  console.log(
    'Login hint: admin@example.com, intake-only@example.com, clinical-only@example.com, cc-only@example.com, full-visibility@example.com — localhost OTP 123456. See docs/PHASE17_VERIFICATION.md'
  )
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
