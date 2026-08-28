import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import {
  canLockClinicalAssessment,
  canUploadClinicalAssessmentArtifacts,
  canViewClinicalAssessment,
} from '@/lib/crm/clinicalAssessment/access'

const clinical = { id: 'u1', crmRoles: ['CLINICAL'] as CrmRole[] }
const support = { id: 'u2', crmRoles: ['CLINICAL_SUPPORT'] as CrmRole[] }
const billing = { id: 'u3', crmRoles: ['BILLING'] as CrmRole[] }
const cc = { id: 'u4', crmRoles: ['CASE_COORDINATION'] as CrmRole[] }
const intake = { id: 'u5', crmRoles: ['INTAKE'] as CrmRole[] }

describe('clinicalAssessment access', () => {
  it('allows view for clinical, billing, and case coordination', () => {
    expect(canViewClinicalAssessment(clinical)).toBe(true)
    expect(canViewClinicalAssessment(support)).toBe(true)
    expect(canViewClinicalAssessment(billing)).toBe(true)
    expect(canViewClinicalAssessment(cc)).toBe(true)
    expect(canViewClinicalAssessment(intake)).toBe(false)
  })

  it('allows upload for clinical and clinical support', () => {
    expect(canUploadClinicalAssessmentArtifacts(clinical)).toBe(true)
    expect(canUploadClinicalAssessmentArtifacts(support)).toBe(true)
    expect(canUploadClinicalAssessmentArtifacts(billing)).toBe(false)
  })

  it('allows lock only for clinical owner, not clinical support', () => {
    expect(canLockClinicalAssessment(clinical)).toBe(true)
    expect(canLockClinicalAssessment(support)).toBe(false)
    expect(canLockClinicalAssessment(billing)).toBe(false)
  })
})
