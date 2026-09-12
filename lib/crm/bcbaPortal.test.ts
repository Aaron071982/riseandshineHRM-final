import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import {
  canViewClientAsAssignedBcba,
  getBcbaPortalClientsWhere,
  hasBcbaPortalAccess,
  isClinicalSurfaceOnly,
  seesAllClinicalClients,
} from '@/lib/crm/bcbaPortal'

const bcba = {
  id: 'bcba-1',
  crmRoles: ['BCBA'] as CrmRole[],
}
const lead = {
  id: 'lead-1',
  crmRoles: ['CLINICAL_LEAD'] as CrmRole[],
}
const intake = {
  id: 'intake-1',
  crmRoles: ['INTAKE'] as CrmRole[],
}
const bcbaPlusIntake = {
  id: 'hybrid-1',
  crmRoles: ['BCBA', 'INTAKE'] as CrmRole[],
}

describe('bcbaPortal access', () => {
  it('grants portal entry to BCBA and CLINICAL_LEAD', () => {
    expect(hasBcbaPortalAccess(bcba)).toBe(true)
    expect(hasBcbaPortalAccess(lead)).toBe(true)
    expect(hasBcbaPortalAccess(intake)).toBe(false)
  })

  it('limits external BCBA and clinical lead to clinical surface tabs', () => {
    expect(isClinicalSurfaceOnly(bcba)).toBe(true)
    expect(isClinicalSurfaceOnly(lead)).toBe(true)
    expect(isClinicalSurfaceOnly(bcbaPlusIntake)).toBe(false)
  })

  it('lets clinical lead see all clients; BCBA only assigned', () => {
    expect(seesAllClinicalClients(lead)).toBe(true)
    expect(seesAllClinicalClients(bcba)).toBe(false)
    expect(getBcbaPortalClientsWhere(bcba)).toEqual({
      AND: [{ deletedAt: null }, { assignedBcbaId: 'bcba-1' }],
    })
    expect(getBcbaPortalClientsWhere(lead)).toEqual({ deletedAt: null })
  })

  it('checks assignment for external BCBA', () => {
    expect(canViewClientAsAssignedBcba(bcba, 'bcba-1')).toBe(true)
    expect(canViewClientAsAssignedBcba(bcba, 'other')).toBe(false)
    expect(canViewClientAsAssignedBcba(lead, 'other')).toBe(true)
  })
})
