import { describe, expect, it } from 'vitest'
import {
  assertRequirementStoragePath,
  isStoredRequirementPath,
  requirementDownloadFileName,
  validateRequirementDocumentFile,
} from './requirementDocuments'

describe('lib/crm/requirementDocuments', () => {
  it('isStoredRequirementPath accepts CRM and legacy client-services paths', () => {
    expect(
      isStoredRequirementPath('crm-client-documents/c1/intake_form-abc.pdf')
    ).toBe(true)
    expect(
      isStoredRequirementPath('client-services/c1/INSURANCE_CARD-123.pdf')
    ).toBe(true)
    expect(isStoredRequirementPath('https://sharepoint.example.com/doc')).toBe(false)
    expect(isStoredRequirementPath(null)).toBe(false)
  })

  it('validateRequirementDocumentFile rejects empty and oversize files', () => {
    expect(
      validateRequirementDocumentFile({ name: 'a.pdf', size: 0, type: 'application/pdf' })
        .ok
    ).toBe(false)
    expect(
      validateRequirementDocumentFile({
        name: 'big.pdf',
        size: 26 * 1024 * 1024,
        type: 'application/pdf',
      }).ok
    ).toBe(false)
    expect(
      validateRequirementDocumentFile({
        name: 'card.png',
        size: 1024,
        type: 'image/png',
      }).ok
    ).toBe(true)
  })

  it('requirementDownloadFileName prefers stored fileName', () => {
    expect(
      requirementDownloadFileName({
        fileName: 'Insurance Card.pdf',
        fileUrl: 'crm-client-documents/x/y.pdf',
        label: 'Insurance card',
      })
    ).toBe('Insurance Card.pdf')
  })

  it('assertRequirementStoragePath accepts paths for the same client and requirement key', () => {
    const clientId = 'client-1'
    const key = 'iep_ifsp'
    const path = `crm-client-documents/${clientId}/iep_ifsp-abc123.pdf`
    expect(assertRequirementStoragePath(path, clientId, key).ok).toBe(true)
    expect(assertRequirementStoragePath(path, 'other-client', key).ok).toBe(false)
    expect(assertRequirementStoragePath(path, clientId, 'insurance_card').ok).toBe(
      false
    )
  })
})
