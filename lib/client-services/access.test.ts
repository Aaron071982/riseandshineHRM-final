import { describe, expect, it } from 'vitest'
import { canAccessClientServices } from './access'
import { PLATFORM_OWNER_EMAIL } from '@/lib/constants'
import type { SessionUser } from '@/lib/auth'

const admin: SessionUser = {
  id: 'admin-1',
  phoneNumber: null,
  role: 'ADMIN',
  email: 'admin@riseandshineaba.com',
  name: 'Admin User',
}

const rbt: SessionUser = {
  id: 'rbt-1',
  phoneNumber: '+15551234567',
  role: 'RBT',
  email: 'therapist@riseandshineaba.com',
  name: 'Therapist User',
  rbtProfileId: 'rbt-profile-1',
}

describe('canAccessClientServices', () => {
  it('allows HRM admin users', async () => {
    expect(await canAccessClientServices(admin)).toBe(true)
  })

  it('denies therapists and other non-admin HRM roles', async () => {
    expect(await canAccessClientServices(rbt)).toBe(false)
    expect(
      await canAccessClientServices({
        ...rbt,
        id: 'bcba-1',
        role: 'BCBA',
        email: 'bcba@riseandshineaba.com',
      })
    ).toBe(false)
  })

  it('allows break-glass allowlist emails regardless of role', async () => {
    expect(
      await canAccessClientServices({
        ...rbt,
        email: PLATFORM_OWNER_EMAIL,
      })
    ).toBe(true)
  })

  it('denies null user', async () => {
    expect(await canAccessClientServices(null)).toBe(false)
  })
})
