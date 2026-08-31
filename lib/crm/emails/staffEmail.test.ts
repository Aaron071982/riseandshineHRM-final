import { describe, expect, it } from 'vitest'
import { graphEmailEnabled } from './graphSend'
import { hasRiseAndShineMailbox, mailboxBlockedReason } from './mailbox'
import { renderStaffEmail, renderWeeklyActivitySummary } from './templates'
import type { StaffMergeFields } from './templates/types'
import {
  greeting,
  parentFirstNameFromFull,
  EMAIL_LOGO_URL,
} from './templates/shell'
import { defaultRbtAssignmentId } from './mergeContext'
import { buildMissingDocsList } from './missingDocs'
import {
  loadTemplateFormAttachments,
  templateFormSpecs,
} from './templateFormAttachments'

describe('lib/crm/emails/mailbox', () => {
  it('accepts @riseandshineaba.com addresses', () => {
    expect(hasRiseAndShineMailbox('staff@riseandshineaba.com')).toBe(true)
  })

  it('rejects gmail and other domains', () => {
    expect(hasRiseAndShineMailbox('user@gmail.com')).toBe(false)
    expect(mailboxBlockedReason('user@gmail.com')).toMatch(/Rise & Shine mailbox/)
  })
})

describe('lib/crm/emails/graphSend flag', () => {
  it('defaults to disabled', () => {
    const prev = process.env.GRAPH_EMAIL_ENABLED
    delete process.env.GRAPH_EMAIL_ENABLED
    expect(graphEmailEnabled()).toBe(false)
    process.env.GRAPH_EMAIL_ENABLED = prev
  })

  it('enables when env is true (trim/case tolerant)', () => {
    const prev = process.env.GRAPH_EMAIL_ENABLED
    process.env.GRAPH_EMAIL_ENABLED = ' True '
    expect(graphEmailEnabled()).toBe(true)
    process.env.GRAPH_EMAIL_ENABLED = prev
  })
})

describe('greeting personalization', () => {
  it('uses parent first name', () => {
    expect(parentFirstNameFromFull('Maria Rivera')).toBe('Maria')
    expect(greeting({ parentFirstName: 'Maria' })).toBe('Hi Maria,')
  })

  it('falls back to Hi there when missing', () => {
    expect(greeting({ parentName: null, parentFirstName: null })).toBe('Hi there,')
    expect(greeting({ parentName: '  ', parentFirstName: null })).toBe('Hi there,')
  })
})

describe('defaultRbtAssignmentId', () => {
  it('prefers primary assignment', () => {
    expect(
      defaultRbtAssignmentId([
        { id: 'a', isPrimary: false },
        { id: 'b', isPrimary: true },
      ])
    ).toBe('b')
  })

  it('falls back to first when no primary', () => {
    expect(
      defaultRbtAssignmentId([
        { id: 'a', isPrimary: false },
        { id: 'b', isPrimary: false },
      ])
    ).toBe('a')
  })
})

describe('buildMissingDocsList', () => {
  it('returns only unsatisfied parent-facing docs in priority order', () => {
    const list = buildMissingDocsList([
      { key: 'physician_referral', label: 'Referral', status: 'PENDING' },
      { key: 'insurance_card', label: 'Insurance', status: 'PENDING' },
      { key: 'eligibility_vob', label: 'VOB', status: 'PENDING' },
      { key: 'diagnostic_eval', label: 'Eval', status: 'RECEIVED' },
    ])
    expect(list[0]).toMatch(/Insurance card/)
    expect(list.some((l) => /referral/i.test(l))).toBe(true)
    expect(list.some((l) => /VOB/i.test(l))).toBe(false)
    expect(list.some((l) => /Eval|Diagnostic/i.test(l))).toBe(false)
  })
})

describe('lib/crm/emails/templates branded render', () => {
  const fields: StaffMergeFields = {
    childFirstName: 'Alex',
    childLastName: 'Rivera',
    parentName: 'Maria Rivera',
    parentFirstName: 'Maria',
    parentEmail: 'maria@example.com',
    parentPhone: '(555) 123-4567',
    clientAddressLine: '123 Main St',
    clientCity: 'Bronx',
    clientState: 'NY',
    clientZip: '10451',
    coordinatorName: 'Jordan Lee',
    coordinatorEmail: 'jordan@riseandshineaba.com',
    coordinatorPhone: '(917) 915-2544',
    coordinatorTitle: 'Case Coordinator',
    portalLink: null,
    missingDocsList: [],
    rbtName: 'Sam Taylor',
    rbtEmail: 'sam@riseandshineaba.com',
    rbtPhone: '(555) 987-6543',
    rbtAddressLine: '456 Oak Ave',
    rbtCity: 'Bronx',
    rbtState: 'NY',
    rbtZip: '10452',
    bcbaName: 'Dr. Pat Chen',
    bcbaEmail: 'pat@riseandshineaba.com',
    bcbaPhone: '(555) 111-2222',
    scheduleSlots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', rbtName: 'Sam Taylor' },
      { dayOfWeek: 3, startTime: '14:00', endTime: '16:00', rbtName: 'Sam Taylor' },
    ],
    startDate: 'March 1, 2026',
    assessmentDate: null,
    assessmentModality: null,
    staffName: 'Intake Team',
    staffEmail: 'intake@riseandshineaba.com',
    companyPhone: '888-898-4774',
    companyEmail: 'info@riseandshineaba.com',
    companyName: 'Rise & Shine ABA',
    teamStaffEmails: [
      'sam@riseandshineaba.com',
      'pat@riseandshineaba.com',
      'jordan@riseandshineaba.com',
    ],
  }

  it('WELCOME uses v1 packet voice and Dear greeting', () => {
    const email = renderStaffEmail('WELCOME', fields)
    expect(email?.subject).toMatch(/Welcome to Rise & Shine ABA/)
    expect(email?.html).toContain('Dear Maria Rivera,')
    expect(email?.html).toContain('Parent Welcome Packet')
    expect(email?.html).toContain('rather answer a question twice')
    expect(email?.html).toContain('The Rise &amp; Shine ABA Team')
    expect(email?.html).toContain(EMAIL_LOGO_URL)
    expect(email?.html).not.toContain('localhost')
    expect(email?.html).not.toContain('#3b82f6')
    expect(email?.html).not.toContain('What to expect next')
  })

  it('CONSENT_REQUEST is intake + consent with email-return instructions', () => {
    const email = renderStaffEmail('CONSENT_REQUEST', fields)
    expect(email?.subject).toMatch(/intake, consent/)
    expect(email?.html).toContain('Client Intake Form (Form 01)')
    expect(email?.html).toContain('Consent &amp; Authorization Form (Form 02)')
    expect(email?.html).toContain('email the finished copies back')
    expect(email?.html).toContain('info@riseandshineaba.com')
    expect(email?.html).toContain('Dear Maria Rivera,')
    expect(email?.html).toContain('Jordan Lee')
    expect(email?.html).not.toContain('Open secure portal')
    expect(email?.html).not.toContain('isn&apos;t encrypted')
    expect(email?.html).not.toContain('don&apos;t email documents')
    expect(email?.html).not.toContain('How to complete consent')
  })

  it('WELCOME does not push a secure portal for forms', () => {
    const email = renderStaffEmail('WELCOME', fields)
    expect(email?.html).toContain('Intake and Consent forms')
    expect(email?.html).not.toContain('secure link')
    expect(email?.html).not.toContain('isn&apos;t encrypted')
  })

  it('DOCS_NEEDED nudge uses missing list without upload links', () => {
    const email = renderStaffEmail(
      'DOCS_NEEDED',
      {
        ...fields,
        missingDocsList: [
          'Insurance card — front and back',
          'Physician referral or prescription for ABA',
        ],
      },
      {
        links: [{ url: 'https://portal.example.com/upload' }],
      }
    )
    expect(email?.subject).toMatch(/One step left/)
    expect(email?.html).toContain('gentle reminder')
    expect(email?.html).toContain('Insurance card — front and back')
    expect(email?.html).toContain('Physician referral')
    expect(email?.html).not.toContain('https://portal.example.com/upload')
    expect(email?.html).not.toContain('Upload documents securely')
    expect(email?.html).not.toContain('Thank you for completing the consent')
    expect(email?.html).not.toContain('Reply with documents')
  })

  it('SCHEDULE_CONFIRMED renders schedule table', () => {
    const email = renderStaffEmail('SCHEDULE_CONFIRMED', fields)
    expect(email?.html).toContain('Monday')
    expect(email?.html).toContain('Sam Taylor')
    expect(email?.html).toContain('9:00 AM')
  })

  it('RBT_ASSIGNED includes therapist contact info', () => {
    const email = renderStaffEmail('RBT_ASSIGNED', fields)
    expect(email?.html).toContain('Sam Taylor')
    expect(email?.html).toContain('(555) 987-6543')
    expect(email?.html).toContain('A. Rivera')
  })

  it('MEET_AND_GREET embeds family guide with CC, RBT, and schedule', () => {
    const email = renderStaffEmail('MEET_AND_GREET', fields)
    expect(email?.subject).toMatch(/Meet.*Greet/)
    expect(email?.html).toContain('Hi Maria,')
    expect(email?.html).toContain('Meet &amp; Greet Guide for Families')
    expect(email?.html).toContain('Sam Taylor')
    expect(email?.html).toContain('Jordan Lee')
    expect(email?.html).toContain('Monday')
    expect(email?.html).toContain('9:00 AM')
    expect(email?.html).toContain('123 Main St')
    expect(email?.html).toContain('official Meet &amp; Greet form')
    expect(email?.html).toContain('send separately')
    expect(email?.html).toContain('Your Case Coordinator')
  })

  it('ASSESSMENT_SCHEDULED reflects in-home vs telehealth choice', () => {
    const inHome = renderStaffEmail('ASSESSMENT_SCHEDULED', fields, {
      assessmentModality: 'IN_HOME',
    })
    expect(inHome?.html).toContain('In-home')

    const tele = renderStaffEmail('ASSESSMENT_SCHEDULED', fields, {
      assessmentModality: 'TELEHEALTH',
    })
    expect(tele?.html).toContain('Telehealth')
  })

  it('lists attachments but not download link buttons when provided', () => {
    const email = renderStaffEmail('WELCOME', fields, {
      attachments: [{ fileName: 'Parent-Welcome-Packet.pdf', sizeBytes: 2048 }],
      links: [{ url: 'https://sign.example.com/abc', label: 'Sign consent' }],
    })
    expect(email?.html).toContain('Attached files')
    expect(email?.html).toContain('Parent-Welcome-Packet.pdf')
    expect(email?.html).not.toContain('Downloads &amp; links')
    expect(email?.html).not.toContain('Sign consent')
    expect(email?.html).not.toContain('https://sign.example.com/abc')
  })

  it('renders journey timeline under the header with auto milestone', () => {
    const welcome = renderStaffEmail('WELCOME', fields)
    expect(welcome?.html).toContain('Your journey with us')
    expect(welcome?.html).toContain('You&rsquo;re here')
    expect(welcome?.html).toMatch(/Progress:[\s\S]*Welcome \(you're here\)/)
    expect(welcome?.html).not.toContain('#3b82f6')
    expect(welcome?.html).not.toContain('#2563eb')

    const docs = renderStaffEmail('DOCS_NEEDED', fields)
    expect(docs?.html).toMatch(/Progress:[\s\S]*Welcome \(done\)[\s\S]*Documents \(you're here\)/)

    const meet = renderStaffEmail('MEET_AND_GREET', fields)
    expect(meet?.html).toMatch(/Services Begin \(you're here\)/)
    expect(meet?.html).toMatch(/Matching Your Therapist \(done\)/)
  })

  it('skips timeline for MANUAL (no mapped milestone)', () => {
    const email = renderStaffEmail('MANUAL', fields, {
      bodyHtml: '<p>Custom note</p>',
      subject: 'Custom',
    })
    expect(email?.html).not.toContain('Your journey with us')
  })

  it('weekly activity summary is internal and branded', () => {
    const email = renderWeeklyActivitySummary({
      weekRange: 'Aug 18–24, 2026',
      sentCount: 2,
      activityRows: [
        {
          date: 'Aug 19',
          sender: 'jordan@riseandshineaba.com',
          recipient: 'maria@example.com',
          template: 'Welcome (packet)',
          stageAtSend: 'INTAKE',
        },
      ],
      pendingFollowups: [
        {
          clientLabel: 'Alex R.',
          note: 'Welcome sent; intake forms not returned',
        },
      ],
      recipientList: ['ops@riseandshineaba.com'],
    })
    expect(email.subject).toMatch(/Client Email Activity/)
    expect(email.html).toContain('Total client emails sent this week')
    expect(email.html).toContain('Welcome (packet)')
    expect(email.html).toContain('awaiting a follow-up')
    expect(email.html).toContain('Internal operations summary')
    expect(email.html).not.toContain('Your journey with us')
    expect(email.html).toContain(EMAIL_LOGO_URL)
  })
})

describe('template form PDF attachments', () => {
  it('maps Welcome → WelcomePacket; Consent request has no auto-attachments', () => {
    expect(templateFormSpecs('WELCOME').map((s) => s.fileName)).toEqual([
      'WelcomePacket.pdf',
    ])
    expect(templateFormSpecs('CONSENT_REQUEST')).toEqual([])
    expect(templateFormSpecs('DOCS_NEEDED')).toEqual([])
  })

  it('loads Welcome PDF bytes from assets/crm-parent-forms', () => {
    const welcome = loadTemplateFormAttachments('WELCOME')
    expect(welcome).toHaveLength(1)
    expect(welcome[0]!.fileName).toBe('WelcomePacket.pdf')
    expect(welcome[0]!.contentBytes.length).toBeGreaterThan(1000)
    expect(welcome[0]!.contentBytes.subarray(0, 4).toString()).toBe('%PDF')

    expect(loadTemplateFormAttachments('CONSENT_REQUEST')).toEqual([])
  })
})
