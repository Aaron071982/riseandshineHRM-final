import { describe, expect, it } from 'vitest'
import {
  authBandForDaysLeft,
  authSeverityForBand,
  stalledSeverity,
  STAGE_JOURNEY_TEMPLATE,
} from '@/lib/crm/alertRules'
import {
  crmEmailsEnabled,
  isJourneyLockedStatus,
  resolveCrmEmailRecipient,
} from '@/lib/crm/emails/safety'

describe('alertRules', () => {
  it('maps auth days into tightest band and severity', () => {
    expect(authBandForDaysLeft(55)).toBe(60)
    expect(authSeverityForBand(60)).toBe('INFO')
    expect(authBandForDaysLeft(30)).toBe(30)
    expect(authSeverityForBand(30)).toBe('WARNING')
    expect(authBandForDaysLeft(10)).toBe(15)
    expect(authBandForDaysLeft(3)).toBe(7)
    expect(authSeverityForBand(7)).toBe('URGENT')
    expect(authBandForDaysLeft(90)).toBeNull()
  })

  it('escalates stalled severity past 2× max', () => {
    expect(stalledSeverity(10, 7)).toBe('WARNING')
    expect(stalledSeverity(15, 7)).toBe('URGENT')
  })

  it('maps stages to journey templates', () => {
    expect(STAGE_JOURNEY_TEMPLATE.CONSENT).toBe('CONSENT_REQUEST')
    expect(STAGE_JOURNEY_TEMPLATE.ACTIVE).toBe('SERVICES_STARTED')
    expect(STAGE_JOURNEY_TEMPLATE.AUTHORIZATION).toBeUndefined()
  })
})

describe('crm email safety', () => {
  it('kill-switch defaults to off', () => {
    const prev = process.env.CRM_EMAILS_ENABLED
    delete process.env.CRM_EMAILS_ENABLED
    expect(crmEmailsEnabled()).toBe(false)
    process.env.CRM_EMAILS_ENABLED = prev
  })

  it('does not resolve a real recipient when disabled', () => {
    const prev = process.env.CRM_EMAILS_ENABLED
    process.env.CRM_EMAILS_ENABLED = 'false'
    const r = resolveCrmEmailRecipient('parent@family.com')
    expect(r.to).toBeNull()
    expect(r.reason).toMatch(/CRM_EMAILS_ENABLED/)
    process.env.CRM_EMAILS_ENABLED = prev
  })

  it('locks SENT and SKIPPED statuses', () => {
    expect(isJourneyLockedStatus('SENT')).toBe(true)
    expect(isJourneyLockedStatus('SKIPPED')).toBe(true)
    expect(isJourneyLockedStatus('FAILED')).toBe(false)
  })
})
