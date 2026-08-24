import { describe, expect, it } from 'vitest'
import { graphEmailEnabled } from './graphSend'
import { hasRiseAndShineMailbox, mailboxBlockedReason } from './mailbox'
import { renderStaffEmail } from './templates'
import type { StaffMergeFields } from './templates/types'
import {
  greeting,
  parentFirstNameFromFull,
  EMAIL_LOGO_URL,
} from './templates/shell'
import { defaultRbtAssignmentId } from './mergeContext'

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
    companyPhone: '(888) 898-4774',
    companyEmail: 'info@riseandshineaba.com',
    companyName: 'Rise & Shine ABA',
  }

  it('WELCOME includes refined shell, greeting, and absolute logo', () => {
    const email = renderStaffEmail('WELCOME', fields)
    expect(email?.subject).toMatch(/Welcome/)
    expect(email?.html).toContain('Hi Maria,')
    expect(email?.html).toContain('Rise & Shine ABA')
    expect(email?.html).toContain('What to expect next')
    expect(email?.html).toContain('(888) 898-4774')
    expect(email?.html).toContain(EMAIL_LOGO_URL)
    expect(email?.html).toContain('https://')
    expect(email?.html).not.toContain('localhost')
    expect(email?.html).not.toContain('#3b82f6')
    expect(email?.html).not.toContain('[Template copy pending')
  })

  it('CONSENT_REQUEST supports consent copy before documents', () => {
    const email = renderStaffEmail('CONSENT_REQUEST', fields)
    expect(email?.html).toContain('signing link')
    expect(email?.html).toContain('Hi Maria,')
  })

  it('DOCS_NEEDED thanks for consent and drops family packet', () => {
    const email = renderStaffEmail('DOCS_NEEDED', fields)
    expect(email?.html).toContain('Thank you for completing the consent')
    expect(email?.html).toContain('Intake form')
    expect(email?.html).toContain('Transfer letter')
    expect(email?.html).not.toContain('Family packet')
    expect(email?.html).not.toContain('Parent consent form')
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

  it('includes attachments and links in preview when provided', () => {
    const email = renderStaffEmail('CONSENT_REQUEST', fields, {
      attachments: [{ fileName: 'consent-zayan.pdf', sizeBytes: 2048 }],
      links: [{ url: 'https://sign.example.com/abc', label: 'Sign consent' }],
    })
    expect(email?.html).toContain('Attached files')
    expect(email?.html).toContain('consent-zayan.pdf')
    expect(email?.html).toContain('Links included')
    expect(email?.html).toContain('Sign consent')
    expect(email?.html).toContain('https://sign.example.com/abc')
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
})
