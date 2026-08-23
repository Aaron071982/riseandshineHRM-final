import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import {
  canEditTrainingContent,
  canViewStaffProfile,
} from '@/lib/crm/training/access'
import { trainingRolesForUser } from '@/lib/crm/training/ensureModules'

describe('lib/crm/training/access', () => {
  const self = { id: 'u1', email: 'a@riseandshineaba.com', crmRoles: ['INTAKE'] as CrmRole[] }
  const manager = {
    id: 'm1',
    email: 'boss@riseandshineaba.com',
    crmRoles: ['MANAGEMENT'] as CrmRole[],
    fullAccess: true,
  }
  const other = { id: 'u2', email: 'b@riseandshineaba.com', crmRoles: ['INTAKE'] as CrmRole[] }

  it('canViewStaffProfile allows self and full-access managers', () => {
    expect(canViewStaffProfile(self, 'u1')).toBe(true)
    expect(canViewStaffProfile(manager, 'u1')).toBe(true)
    expect(canViewStaffProfile(other, 'u1')).toBe(false)
  })

  it('canEditTrainingContent requires full access', () => {
    expect(canEditTrainingContent(self)).toBe(false)
    expect(canEditTrainingContent(manager)).toBe(true)
  })
})

describe('trainingRolesForUser', () => {
  it('maps SUPER_ADMIN to MANAGEMENT training module', () => {
    expect(trainingRolesForUser(['SUPER_ADMIN'])).toContain('MANAGEMENT')
  })

  it('includes department roles with modules', () => {
    const roles = trainingRolesForUser(['INTAKE', 'CASE_COORDINATION'])
    expect(roles).toContain('INTAKE')
    expect(roles).toContain('CASE_COORDINATION')
  })
})
