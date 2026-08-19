import { describe, expect, it } from 'vitest'
import {
  computeExpiresAt,
  isDocumentRequired,
  LEGACY_DOCUMENT_KEY_MAP,
  DOCUMENT_BY_KEY,
} from './documents'
import { requirementStatusSatisfies, canAdvance } from './stages'
import {
  computeConsentBillingReady,
  emptyConsentLines,
} from './consent'
import { evaluateReferralValidity } from './referralValidity'

describe('canonical documents', () => {
  it('maps legacy keys without dropping them', () => {
    expect(LEGACY_DOCUMENT_KEY_MAP.custody_guardian).toBe('intake_form')
    expect(LEGACY_DOCUMENT_KEY_MAP.prior_aba_records).toBe('prior_aba')
    expect(LEGACY_DOCUMENT_KEY_MAP.consent_form_signed).toBe('consent_form')
  })

  it('keeps insurance and psych eval in the intake section', () => {
    expect(DOCUMENT_BY_KEY.insurance_card.group).toBe('INTAKE')
    expect(DOCUMENT_BY_KEY.insurance_card.stage).toBe('BENEFITS')
    expect(DOCUMENT_BY_KEY.diagnostic_eval.group).toBe('INTAKE')
    expect(DOCUMENT_BY_KEY.diagnostic_eval.stage).toBe('AUTHORIZATION')
  })

  it('computes 3yr / 12mo validity windows', () => {
    const from = new Date('2026-01-15T00:00:00Z')
    const evalExp = computeExpiresAt('diagnostic_eval', from)!
    const refExp = computeExpiresAt('physician_referral', from)!
    expect(evalExp.getUTCFullYear()).toBe(2029)
    expect(refExp.getUTCFullYear()).toBe(2027)
  })

  it('consent_form cannot be attested on-file', () => {
    expect(DOCUMENT_BY_KEY.consent_form.attestAllowed).toBe(false)
    expect(requirementStatusSatisfies('consent_form', 'ON_FILE')).toBe(false)
    expect(requirementStatusSatisfies('insurance_card', 'ON_FILE')).toBe(true)
    expect(requirementStatusSatisfies('insurance_card', 'RECEIVED')).toBe(true)
  })

  it('expired windows fail the gate even if RECEIVED', () => {
    expect(
      requirementStatusSatisfies(
        'diagnostic_eval',
        'RECEIVED',
        new Date('2020-01-01')
      )
    ).toBe(false)
  })
})

describe('consent billing gate', () => {
  it('is ready only when 97151 and 97153 are initialed', () => {
    const lines = emptyConsentLines()
    expect(computeConsentBillingReady(lines)).toBe(false)
    lines.cpt_97151 = { initialed: true, initialedAt: 'x', initialedBy: 'u' }
    expect(computeConsentBillingReady(lines)).toBe(false)
    lines.cpt_97153 = { initialed: true, initialedAt: 'x', initialedBy: 'u' }
    expect(computeConsentBillingReady(lines)).toBe(true)
  })

  it('blocks ACTIVE without billing-ready consent', () => {
    const gate = canAdvance(
      {
        stage: 'PRE_START',
        treatmentPlanStatus: 'COMPLETE',
        consentBillingReady: false,
      },
      [
        {
          key: 'meet_and_greet_done',
          stage: 'PRE_START',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
        {
          key: 'start_date_set',
          stage: 'PRE_START',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
      ]
    )
    expect(gate.ok).toBe(false)
    expect(gate.blockedBy).toContain('consent_billing_ready')
  })
})

describe('referral validity', () => {
  it('blocks incomplete NY Medicaid referral', () => {
    const incomplete = evaluateReferralValidity({
      signedByRole: null,
      hasAsdDx: false,
      initialDxDate: null,
      severitySupportLevel: null,
      abaRequiredStatement: false,
      dsm5ChecklistAttached: false,
    })
    expect(incomplete.ok).toBe(false)
    expect(incomplete.missing).toContain('signed_by_qualified_provider')

    const complete = evaluateReferralValidity({
      signedByRole: 'PHYSICIAN',
      hasAsdDx: true,
      initialDxDate: '2024-01-01',
      severitySupportLevel: 'Level 2',
      abaRequiredStatement: true,
      dsm5ChecklistAttached: true,
    })
    expect(complete.ok).toBe(true)
  })

  it('canAdvance blocks INTAKE when Medicaid referral is invalid', () => {
    const gate = canAdvance(
      {
        stage: 'INTAKE',
        referralValid: false,
        requiresMedicaidReferral: true,
      },
      [
        {
          key: 'intake_packet_complete',
          stage: 'INTAKE',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
        {
          key: 'demographics_complete',
          stage: 'INTAKE',
          status: 'COMPLETE',
          isRequiredToAdvance: true,
        },
      ]
    )
    expect(gate.ok).toBe(false)
    expect(gate.blockedBy).toContain('physician_referral_validity')
  })
})
