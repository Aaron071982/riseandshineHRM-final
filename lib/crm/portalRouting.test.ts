import { describe, expect, it } from 'vitest'
import type { CrmRole } from '@prisma/client'
import { getPostLoginPathForCrmUser, PORTAL_HOME_PATH } from '@/lib/crm/portalRouting'
import { CLIENT_SERVICES_HOME_PATH } from '@/lib/auth/postLogin'

describe('portalRouting', () => {
  it('sends portal-only BCBA / CLINICAL_LEAD to /portal', () => {
    expect(
      getPostLoginPathForCrmUser({
        role: 'BCBA',
        email: 'bcba@outside.test',
        crmRoles: ['BCBA'] as CrmRole[],
      })
    ).toBe(PORTAL_HOME_PATH)

    expect(
      getPostLoginPathForCrmUser({
        role: 'ADMIN',
        email: 'shazia@riseandshineaba.com',
        crmRoles: ['CLINICAL_LEAD'] as CrmRole[],
      })
    ).toBe(PORTAL_HOME_PATH)
  })

  it('keeps hybrid CRM staff on the Client Services home', () => {
    expect(
      getPostLoginPathForCrmUser({
        role: 'ADMIN',
        email: 'staff@riseandshineaba.com',
        crmRoles: ['BCBA', 'INTAKE'] as CrmRole[],
      })
    ).toBe(CLIENT_SERVICES_HOME_PATH)
  })
})
