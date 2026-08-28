import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import {
  canAccessBillingSurface,
  canDownloadClientDocuments,
  canViewBillingDocuments,
} from '@/lib/crm/billingAccess'

const billingUser = { id: 'u1', crmRoles: ['BILLING'] as CrmRole[] }
const authUser = { id: 'u2', crmRoles: ['AUTHORIZATION'] as CrmRole[] }
const intakeUser = { id: 'u3', crmRoles: ['INTAKE'] as CrmRole[] }
const fullAccess = { id: 'u4', crmRoles: [] as CrmRole[], fullAccess: true }

describe('billingAccess', () => {
  it('allows billing and authorization CRM roles', () => {
    expect(canAccessBillingSurface(billingUser)).toBe(true)
    expect(canAccessBillingSurface(authUser)).toBe(true)
    expect(canAccessBillingSurface(intakeUser)).toBe(false)
    expect(canAccessBillingSurface(fullAccess)).toBe(true)
  })

  it('opens billing documents from Benefits onward', () => {
    expect(canViewBillingDocuments('DOCUMENTS')).toBe(false)
    expect(canViewBillingDocuments('BENEFITS')).toBe(true)
    expect(canViewBillingDocuments('AUTHORIZATION')).toBe(true)
  })

  it('restricts billing-only users before VOB stage', () => {
    expect(canDownloadClientDocuments(billingUser, 'DOCUMENTS')).toBe(false)
    expect(canDownloadClientDocuments(billingUser, 'BENEFITS')).toBe(true)
    expect(canDownloadClientDocuments(intakeUser, 'DOCUMENTS')).toBe(true)
    expect(canDownloadClientDocuments(fullAccess, 'INQUIRY')).toBe(true)
  })
})
