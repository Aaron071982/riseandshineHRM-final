import { describe, expect, it } from 'vitest'
import {
  authBandForDaysLeft,
  authSeverityForBand,
  stalledSeverity,
  STAGE_JOURNEY_TEMPLATE,
} from '@/lib/crm/alertRules'
import {
  crmEmailsEnabled,
  crmJourneyEmailsEnabled,
  isJourneyLockedStatus,
  resolveCrmEmailRecipient,
} from '@/lib/crm/emails/safety'
import { sendJourneyTemplate } from '@/lib/crm/emails/send'

describe('alertRules', () => {
  it('maps auth days into tightest band and severity', () => {
    expect(authBandForDaysLeft(44)).toBe(45)
    expect(authSeverityForBand(45)).toBe('INFO')
    expect(authBandForDaysLeft(30)).toBe(30)
    expect(authSeverityForBand(30)).toBe('WARNING')
    expect(authBandForDaysLeft(10)).toBe(14)
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

  it('parent stage-transition emails require a separate explicit opt-in', () => {
    const prev = process.env.CRM_JOURNEY_EMAILS_ENABLED
    delete process.env.CRM_JOURNEY_EMAILS_ENABLED
    expect(crmJourneyEmailsEnabled()).toBe(false)
    process.env.CRM_JOURNEY_EMAILS_ENABLED = 'false'
    expect(crmJourneyEmailsEnabled()).toBe(false)
    process.env.CRM_JOURNEY_EMAILS_ENABLED = 'true'
    expect(crmJourneyEmailsEnabled()).toBe(true)
    if (prev == null) delete process.env.CRM_JOURNEY_EMAILS_ENABLED
    else process.env.CRM_JOURNEY_EMAILS_ENABLED = prev
  })

  it('standby exits before loading a client or creating a communication', async () => {
    const prev = process.env.CRM_JOURNEY_EMAILS_ENABLED
    process.env.CRM_JOURNEY_EMAILS_ENABLED = 'false'
    const result = await sendJourneyTemplate(
      'does-not-exist-and-must-not-be-queried',
      'READY_FOR_STAFFING'
    )
    expect(result).toEqual({
      status: 'SKIPPED',
      reason: 'CRM_JOURNEY_EMAILS_ENABLED is not true',
      to: null,
    })
    if (prev == null) delete process.env.CRM_JOURNEY_EMAILS_ENABLED
    else process.env.CRM_JOURNEY_EMAILS_ENABLED = prev
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
