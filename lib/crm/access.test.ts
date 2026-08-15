import { describe, expect, it } from 'vitest'
import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'
import {
  canEditClientRecord,
  canViewClientRecord,
  getVisibleClientsWhere,
  isFullAccess,
} from './access'

const fullUser = {
  id: 'user-full',
  email: PLATFORM_OWNER_EMAIL,
  name: 'Admin',
  role: 'ADMIN' as const,
  phoneNumber: null,
  isActive: true,
  fullAccess: true,
}

const coordinatorUser = {
  id: 'user-coord',
  email: 'coord-not-on-allowlist@other.test',
  name: 'Coord',
  role: 'ADMIN' as const,
  phoneNumber: null,
  isActive: true,
  fullAccess: false,
}

describe('lib/crm/access', () => {
  it('isFullAccess follows CLIENT_SERVICES_FULL_ACCESS_EMAILS allowlist helpers', () => {
    expect(isFullAccess({ email: PLATFORM_OWNER_EMAIL })).toBe(true)
    expect(isFullAccess({ email: 'coord-not-on-allowlist@other.test' })).toBe(false)
  })

  it('getVisibleClientsWhere returns {} for full-access', () => {
    expect(getVisibleClientsWhere(fullUser)).toEqual({})
  })

  it('getVisibleClientsWhere scopes coordinators to caseCoordinatorUserId', () => {
    expect(getVisibleClientsWhere(coordinatorUser)).toEqual({
      caseCoordinatorUserId: 'user-coord',
    })
  })

  it('assertCanEditClient permission rejects coordinator on another client', () => {
    const otherClient = { caseCoordinatorUserId: 'someone-else' }
    expect(canEditClientRecord(coordinatorUser, otherClient)).toBe(false)
    expect(canViewClientRecord(coordinatorUser, otherClient)).toBe(false)
  })

  it('coordinator can edit their own assigned client', () => {
    const mine = { caseCoordinatorUserId: 'user-coord' }
    expect(canEditClientRecord(coordinatorUser, mine)).toBe(true)
  })

  it('full-access can edit any client', () => {
    expect(
      canEditClientRecord(fullUser, { caseCoordinatorUserId: 'someone-else' })
    ).toBe(true)
  })
})
