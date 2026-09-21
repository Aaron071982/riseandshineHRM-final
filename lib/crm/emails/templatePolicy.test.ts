import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import {
  allowedTemplatesForClient,
  allowedTemplatesForUser,
  assertTemplateAllowedForUser,
  isTemplateAllowedForUser,
  templatesForRoles,
} from './templatePolicy'

const intake = { id: 'u1', email: 'a@riseandshineaba.com', crmRoles: ['INTAKE'] as CrmRole[] }
const billing = { id: 'u2', email: 'b@riseandshineaba.com', crmRoles: ['BILLING'] as CrmRole[] }
const cc = {
  id: 'u3',
  email: 'c@riseandshineaba.com',
  crmRoles: ['CASE_COORDINATION'] as CrmRole[],
}
const clinical = { id: 'u4', email: 'd@riseandshineaba.com', crmRoles: ['CLINICAL'] as CrmRole[] }
const full = { id: 'u5', email: 'admin@example.com', fullAccess: true, crmRoles: [] as CrmRole[] }

describe('lib/crm/emails/templatePolicy', () => {
  it('INTAKE sees welcome, consent, docs, and waitlist notice', () => {
    expect(templatesForRoles(['INTAKE'])).toEqual([
      'WELCOME',
      'CONSENT_REQUEST',
      'DOCS_NEEDED',
      'WAITLIST_NOTICE',
    ])
    expect(isTemplateAllowedForUser(intake, 'WELCOME')).toBe(true)
    expect(isTemplateAllowedForUser(intake, 'RBT_ASSIGNED')).toBe(false)
  })

  it('BILLING sees benefits/auth templates', () => {
    expect(templatesForRoles(['BILLING'])).toEqual([
      'BENEFITS_UPDATE',
      'AUTH_APPROVED',
    ])
    expect(isTemplateAllowedForUser(billing, 'AUTH_APPROVED')).toBe(true)
    expect(isTemplateAllowedForUser(billing, 'WELCOME')).toBe(false)
  })

  it('CASE_COORDINATION sees scheduling templates', () => {
    expect(isTemplateAllowedForUser(cc, 'MEET_AND_GREET')).toBe(true)
    expect(isTemplateAllowedForUser(cc, 'CONSENT_REQUEST')).toBe(true)
    expect(isTemplateAllowedForUser(cc, 'DOCS_NEEDED')).toBe(false)
  })

  it('CLINICAL sees assessment and BCBA assignment templates', () => {
    expect(isTemplateAllowedForUser(clinical, 'ASSESSMENT_SCHEDULED')).toBe(true)
    expect(isTemplateAllowedForUser(clinical, 'BCBA_ASSIGNED')).toBe(true)
    expect(isTemplateAllowedForUser(clinical, 'WELCOME')).toBe(false)
  })

  it('CASE_COORDINATION includes BCBA assignment', () => {
    expect(isTemplateAllowedForUser(cc, 'BCBA_ASSIGNED')).toBe(true)
  })

  it('full-access sees all staff templates', () => {
    expect(allowedTemplatesForUser(full).length).toBeGreaterThan(10)
    expect(isTemplateAllowedForUser(full, 'MANUAL')).toBe(true)
  })

  it('waitlist clients only get WAITLIST_NOTICE', () => {
    expect(allowedTemplatesForClient(full, 'WAITLIST')).toEqual(['WAITLIST_NOTICE'])
    expect(allowedTemplatesForClient(intake, 'WAITLIST')).toEqual(['WAITLIST_NOTICE'])
    expect(isTemplateAllowedForUser(full, 'WELCOME', 'WAITLIST')).toBe(false)
    expect(isTemplateAllowedForUser(full, 'WAITLIST_NOTICE', 'WAITLIST')).toBe(true)
  })

  it('non-waitlist clients do not see WAITLIST_NOTICE in the compose list', () => {
    expect(allowedTemplatesForClient(full, 'INQUIRY')).not.toContain('WAITLIST_NOTICE')
    expect(allowedTemplatesForClient(intake, 'INQUIRY')).not.toContain('WAITLIST_NOTICE')
  })

  it('assertTemplateAllowedForUser throws for disallowed template', () => {
    expect(() => assertTemplateAllowedForUser(intake, 'RBT_ASSIGNED')).toThrow(
      /not permitted/
    )
    expect(() => assertTemplateAllowedForUser(full, 'WELCOME', 'WAITLIST')).toThrow(
      /Waitlist clients/
    )
  })
})
