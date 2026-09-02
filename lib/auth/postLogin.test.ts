import { describe, expect, it } from 'vitest'
import {
  CLIENT_SERVICES_HOME_PATH,
  getPostLoginPath,
  shouldRedirectAdminToCrm,
} from './postLogin'

describe('lib/auth/postLogin', () => {
  it('sends non-HRM-default admins to Client Services', () => {
    expect(shouldRedirectAdminToCrm('afsana@riseandshineaba.com', 'ADMIN')).toBe(true)
    expect(getPostLoginPath('ADMIN', 'afsana@riseandshineaba.com')).toBe(
      CLIENT_SERVICES_HOME_PATH
    )
  })

  it('keeps irsal and tisha on the HRM admin dashboard', () => {
    expect(shouldRedirectAdminToCrm('irsal@riseandshineaba.com', 'ADMIN')).toBe(false)
    expect(shouldRedirectAdminToCrm('tisha@riseandshineaba.com', 'ADMIN')).toBe(false)
    expect(getPostLoginPath('ADMIN', 'irsal@riseandshineaba.com')).toBe('/admin/dashboard')
    expect(getPostLoginPath('ADMIN', 'tisha@riseandshineaba.com')).toBe('/admin/dashboard')
  })

  it('does not redirect non-admin roles to CRM', () => {
    expect(shouldRedirectAdminToCrm('afsana@riseandshineaba.com', 'RBT')).toBe(false)
    expect(getPostLoginPath('RBT', 'afsana@riseandshineaba.com')).toBe('/rbt/dashboard')
  })
})
