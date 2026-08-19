import { describe, expect, it } from 'vitest'
import { graphEmailEnabled } from './graphSend'
import { hasRiseAndShineMailbox, mailboxBlockedReason } from './mailbox'
import { renderStaffEmail } from './templates'

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

describe('lib/crm/emails/templates branded render', () => {
  const fields = {
    childFirstName: 'Alex',
    childLastName: 'Rivera',
    parentName: 'Maria Rivera',
    parentEmail: 'maria@example.com',
    coordinatorName: 'Jordan Lee',
    rbtName: 'Sam Taylor',
    startDate: 'March 1, 2026',
    assessmentDate: null,
    staffName: 'Intake Team',
    staffEmail: 'intake@riseandshineaba.com',
    companyPhone: '(888) 898-4774',
    companyEmail: 'info@riseandshineaba.com',
    companyName: 'Rise & Shine ABA',
  }

  it('WELCOME includes branded shell and next steps', () => {
    const email = renderStaffEmail('WELCOME', fields)
    expect(email?.subject).toBe('Welcome to Rise & Shine ABA!')
    expect(email?.html).toContain('Rise & Shine ABA')
    expect(email?.html).toContain('What happens next')
    expect(email?.html).toContain('(888) 898-4774')
    expect(email?.html).toContain('https://www.riseandshinehrm.com/new-real-logo.png')
    expect(email?.html).not.toContain('localhost')
    expect(email?.html).not.toContain('src="/new-real-logo.png"')
  })

  it('DOCS_NEEDED lists required documents', () => {
    const email = renderStaffEmail('DOCS_NEEDED', fields)
    expect(email?.subject).toContain('Thank you for choosing')
    expect(email?.html).toContain('Autism Diagnosis')
    expect(email?.html).toContain('Insurance Card')
  })
})
