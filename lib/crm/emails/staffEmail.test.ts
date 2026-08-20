import { describe, expect, it } from 'vitest'
import { graphEmailEnabled } from './graphSend'
import { hasRiseAndShineMailbox, mailboxBlockedReason } from './mailbox'
import { renderStaffEmail } from './templates'
import {
  greeting,
  parentFirstNameFromFull,
  EMAIL_LOGO_URL,
} from './templates/shell'

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

describe('lib/crm/emails/templates branded render', () => {
  const fields = {
    childFirstName: 'Alex',
    childLastName: 'Rivera',
    parentName: 'Maria Rivera',
    parentFirstName: 'Maria',
    parentEmail: 'maria@example.com',
    coordinatorName: 'Jordan Lee',
    rbtName: 'Sam Taylor',
    startDate: 'March 1, 2026',
    assessmentDate: null as string | null,
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
    expect(email?.html).toContain('What happens next')
    expect(email?.html).toContain('(888) 898-4774')
    expect(email?.html).toContain(EMAIL_LOGO_URL)
    expect(email?.html).toContain('https://')
    expect(email?.html).not.toContain('localhost')
    expect(email?.html).not.toContain('src="/new-real-logo.png"')
    expect(email?.html).not.toContain('[Template copy pending')
  })

  it('DOCS_NEEDED lists required documents with greeting', () => {
    const email = renderStaffEmail('DOCS_NEEDED', fields)
    expect(email?.html).toContain('Hi Maria,')
    expect(email?.html).toContain('Insurance card')
    expect(email?.html).toContain('Psychological evaluation')
  })

  it('ASSESSMENT_SCHEDULED is finished copy (not stub pending)', () => {
    const email = renderStaffEmail('ASSESSMENT_SCHEDULED', {
      ...fields,
      assessmentDate: 'April 3, 2026',
    })
    expect(email?.html).toContain('Hi Maria,')
    expect(email?.html).toContain('April 3, 2026')
    expect(email?.html).toContain('Before the visit')
    expect(email?.html).not.toContain('[Template copy pending')
  })

  it('includes attachments strip in preview when provided', () => {
    const email = renderStaffEmail('CONSENT_REQUEST', fields, {
      attachments: [{ fileName: 'consent-zayan.pdf', sizeBytes: 2048 }],
    })
    expect(email?.html).toContain('Attachments')
    expect(email?.html).toContain('consent-zayan.pdf')
  })
})
